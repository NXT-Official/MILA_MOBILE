import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { Redirect, useRouter } from "expo-router";

jest.mock("expo-linking", () => ({ useLinkingURL: jest.fn() }));
jest.mock("expo-router", () => ({
  Redirect: jest.fn(() => null),
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));
jest.mock("../src/services/api/auth", () => ({
  completeAuthCallback: jest.fn(),
  GOOGLE_NATIVE_BUILD_REQUIRED: "Google sign-in needs the installed Mila app. Use email and password here.",
}));
jest.mock("../src/features/auth/hooks/use-app-destination", () => ({ useAppDestination: jest.fn() }));
// The launch hold (holding view after 5 s) is covered with the real hook in
// auth-callback-holding-test; here the gate is mocked, so the hold is too.
jest.mock("../src/features/auth/hooks/use-launch-hold", () => ({
  useLaunchHold: () => ({ stalled: false, stage: "profile", retryProfile: jest.fn(), profileRetrying: false }),
}));
jest.mock("../src/components/layout/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

import { AuthCallbackScreen } from "@/features/auth/AuthCallbackScreen";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { useAppDestination } from "@/features/auth/hooks/use-app-destination";
import { completeAuthCallback, GOOGLE_NATIVE_BUILD_REQUIRED } from "@/services/api/auth";

const callback = "mila://auth/callback#access_token=test-access&refresh_token=test-refresh";
const complete = jest.mocked(completeAuthCallback);
const destination = jest.mocked(useAppDestination);
const linking = jest.mocked(Linking.useLinkingURL);
const replace = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  linking.mockReturnValue(callback);
  complete.mockResolvedValue({} as Awaited<ReturnType<typeof completeAuthCallback>>);
  destination.mockReturnValue({ ready: true, destination: "/onboarding/welcome" });
  // Only replace is exercised; the rest of the native router is outside this test.
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
});

test.each(["/onboarding/welcome", "/", "/suspended"] as const)(
  "cold email callback verifies link and follows member gate to %s",
  async (target) => {
    destination.mockReturnValue({ ready: true, destination: target });
    await render(<AuthCallbackScreen />);
    await waitFor(() => expect(Redirect).toHaveBeenCalledWith(expect.objectContaining({ href: target }), undefined));
    expect(complete).toHaveBeenCalledWith(callback);
  },
);

test("waits inside native callback until profile has loaded", async () => {
  destination.mockReturnValue({ ready: false, destination: "/onboarding/welcome" });
  const screen = await render(<AuthCallbackScreen />);
  expect(screen.getByText("Verifying your sign-in…")).toBeTruthy();
  expect(Redirect).not.toHaveBeenCalled();
  destination.mockReturnValue({ ready: true, destination: "/onboarding/welcome" });
  await screen.rerender(<AuthCallbackScreen />);
  await waitFor(() => expect(Redirect).toHaveBeenCalled());
  expect(complete).toHaveBeenCalledTimes(1);
});

test("failed link stays native, allows retry, then resumes onboarding", async () => {
  complete.mockRejectedValueOnce(new Error("expired"));
  const screen = await render(<AuthCallbackScreen />);
  await waitFor(() => expect(screen.getByText("Sign-in could not finish")).toBeTruthy());
  expect(Redirect).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(Redirect).toHaveBeenCalled());
  expect(complete).toHaveBeenCalledTimes(2);
});

test("missing link offers native login instead of hanging or opening website", async () => {
  linking.mockReturnValue(null);
  const screen = await render(<AuthCallbackScreen />);
  expect(screen.getByText("Sign-in could not finish")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back to sign in" }));
  expect(replace).toHaveBeenCalledWith("/login");
  expect(complete).not.toHaveBeenCalled();
});

test("Google button shows failure and allows next attempt", async () => {
  const onPress = jest.fn().mockRejectedValueOnce(new Error("provider internal detail")).mockResolvedValue(null);
  const screen = await render(<GoogleButton onPress={onPress} />);
  await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
  expect(screen.getByText("Google sign-in could not finish. Check your connection and retry.")).toBeTruthy();
  expect(screen.queryByText("provider internal detail")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
  expect(screen.queryByText("Google sign-in could not finish. Check your connection and retry.")).toBeNull();
});

test("Expo Go explains native Google requirement without exposing provider errors", async () => {
  const screen = await render(<GoogleButton onPress={jest.fn().mockRejectedValue(new Error(GOOGLE_NATIVE_BUILD_REQUIRED))} />);
  await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
  expect(screen.getByText(GOOGLE_NATIVE_BUILD_REQUIRED)).toBeTruthy();
});

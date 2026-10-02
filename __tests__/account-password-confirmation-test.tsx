import { fireEvent, render } from "@testing-library/react-native";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("../src/components/layout/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { email: string } } }) => unknown) =>
    select({ session: { user: { email: "member@example.test" } } }),
}));
jest.mock("../src/features/settings/hooks/use-account-actions", () => ({
  useChangeEmail: jest.fn(),
  useChangePassword: jest.fn(),
}));
// The real gate embeds an hCaptcha WebView that cannot mint a token under
// jest; the helper module hands the screen a fixed token on press. It is
// loaded lazily inside the factory because element creation in a factory is
// illegal here (the nativewind transform turns it into out-of-scope refs).
jest.mock("../src/components/feedback/CaptchaGate", () =>
  require("../src/test-utils/captcha-gate-mock"),
);

import { AccountScreen } from "@/features/settings/AccountScreen";
import { useChangeEmail, useChangePassword } from "@/features/settings/hooks/use-account-actions";

function mockHooks() {
  // react-query fires onSuccess then onSettled — mirror that so the screen's
  // captcha reset (onSettled) is exercised too.
  const mutate = jest.fn(
    (_input: unknown, options: { onSuccess?: () => void; onSettled?: () => void }) => {
      options.onSuccess?.();
      options.onSettled?.();
    },
  );
  jest.mocked(useChangeEmail).mockReturnValue({} as ReturnType<typeof useChangeEmail>);
  jest
    .mocked(useChangePassword)
    .mockReturnValue({ mutate } as unknown as ReturnType<typeof useChangePassword>);
  return mutate;
}

async function fillPasswords(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.changeText(screen.getByLabelText("Current password"), "PreviousPass1!");
  await fireEvent.changeText(screen.getByLabelText("New password"), "NextPassword2!");
  await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "NextPassword2!");
}

test("password change stays blocked until confirmation matches, then clears all password fields", async () => {
  const mutate = mockHooks();
  const screen = await render(<AccountScreen />);
  await fireEvent.changeText(screen.getByLabelText("Current password"), "PreviousPass1!");
  await fireEvent.changeText(screen.getByLabelText("New password"), "NextPassword2!");
  await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "DifferentPass3!");
  await fireEvent.press(screen.getByRole("button", { name: "Change password" }));
  expect(mutate).not.toHaveBeenCalled();
  expect(screen.getByText("Passwords don't match.")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "NextPassword2!");
  await fireEvent.press(screen.getByLabelText("Verify you are human"));
  await fireEvent.press(screen.getByRole("button", { name: "Change password" }));
  expect(mutate).toHaveBeenCalledWith(
    {
      currentPassword: "PreviousPass1!",
      newPassword: "NextPassword2!",
      captchaToken: "test-token",
    },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
  for (const label of ["Current password", "New password", "Confirm new password"]) {
    expect(screen.getByLabelText(label).props.value).toBe("");
  }
});

test("the change button also requires the human check, like sign-in", async () => {
  const mutate = mockHooks();
  const screen = await render(<AccountScreen />);
  await fillPasswords(screen);
  // Everything typed correctly — but with no captcha token the re-auth (a
  // captcha-protected password grant) must not be attempted.
  await fireEvent.press(screen.getByRole("button", { name: "Change password" }));
  expect(mutate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText("Verify you are human"));
  await fireEvent.press(screen.getByRole("button", { name: "Change password" }));
  expect(mutate).toHaveBeenCalledTimes(1);
});

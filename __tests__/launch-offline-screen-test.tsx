/**
 * The holding view the launch gate shows when the startup session restore has
 * gone 5 s without an answer: offline, a captive portal, a dead connection.
 * Before it, she saw a frozen splash with no feedback and no way out.
 *
 * It must: say plainly what is happening, offer an immediate retry that shows
 * when it is trying, and offer login without deleting the session on this
 * phone (a later successful restore still opens the app).
 */
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";

import { LaunchOfflineScreen } from "@/features/auth/LaunchOfflineScreen";
import { useAuthStore } from "@/stores/auth-store";

beforeEach(() => {
  useAuthStore.setState({
    session: null,
    loading: true,
    recovery: false,
    launchStalled: true,
    launchAttempting: false,
    launchRetryRequests: 0,
  });
});

it("says what is happening in plain words, with no dashes as punctuation", async () => {
  await render(<LaunchOfflineScreen />);

  expect(screen.getByText("Can't reach Mila right now")).toBeTruthy();
  expect(screen.getByText("We'll keep trying. Mila opens on its own once you're connected.")).toBeTruthy();
  // Every string in the tree, accessibility hints included.
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/[–—]/);
});

it("Try again asks for an attempt now", async () => {
  await render(<LaunchOfflineScreen />);

  fireEvent.press(screen.getByRole("button", { name: "Try again" }));

  expect(useAuthStore.getState().launchRetryRequests).toBe(1);
});

it("Try again shows it is busy while an attempt is out, and cannot be pressed twice", async () => {
  useAuthStore.setState({ launchAttempting: true });
  await render(<LaunchOfflineScreen />);

  const retry = screen.getByRole("button", { name: "Try again" });
  expect(retry.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  fireEvent.press(retry);
  expect(useAuthStore.getState().launchRetryRequests).toBe(0);
});

it("Sign in again opens login and keeps the session on this phone", async () => {
  await render(<LaunchOfflineScreen />);

  const signIn = screen.getByRole("button", { name: "Sign in again" });
  expect(signIn.props.accessibilityHint).toBe("Opens the sign-in screen. Nothing on this phone is deleted.");
  fireEvent.press(signIn);

  expect(useAuthStore.getState()).toMatchObject({ loading: false, session: null, launchStalled: false });
});

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
    launchRetryRunning: false,
  });
});

it("says what is happening in plain words, with no dashes as punctuation", async () => {
  await render(<LaunchOfflineScreen />);

  expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
  expect(screen.getByText("Your connection seems slow or offline. Mila opens on its own as soon as it gets through.")).toBeTruthy();
  // Every string in the tree, accessibility hints included.
  expect(JSON.stringify(screen.toJSON())).not.toMatch(/[–—]/);
});

it("Try again asks for an attempt now", async () => {
  await render(<LaunchOfflineScreen />);

  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

  expect(useAuthStore.getState().launchRetryRequests).toBe(1);
});

it("Try again shows it is busy while the attempt she asked for is running, and cannot be pressed twice", async () => {
  // Busy means "her press is running" (`launchRetryRunning`), not "an
  // automatic attempt is out" (`launchAttempting`): see the next test.
  useAuthStore.setState({ launchRetryRunning: true });
  await render(<LaunchOfflineScreen />);

  const retry = screen.getByRole("button", { name: "Try again" });
  expect(retry.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  await fireEvent.press(retry);
  expect(useAuthStore.getState().launchRetryRequests).toBe(0);
});

it("Try again stays usable while only an automatic attempt is out", async () => {
  useAuthStore.setState({ launchAttempting: true });
  await render(<LaunchOfflineScreen />);

  const retry = screen.getByRole("button", { name: "Try again" });
  expect(retry.props.accessibilityState).toMatchObject({ busy: false, disabled: false });
  await fireEvent.press(retry);
  expect(useAuthStore.getState()).toMatchObject({ launchRetryRequests: 1, launchRetryRunning: true });
});

it("Sign in again opens login and keeps the session on this phone", async () => {
  await render(<LaunchOfflineScreen />);

  const signIn = screen.getByRole("button", { name: "Sign in again" });
  expect(signIn.props.accessibilityHint).toBe("Opens the sign-in screen. Nothing on this phone is deleted.");
  await fireEvent.press(signIn);

  expect(useAuthStore.getState()).toMatchObject({ loading: false, session: null, launchStalled: false });
});

describe("once she is signed in and only her profile is waiting", () => {
  it("offers Try again only: Sign in again makes no sense when she is signed in", async () => {
    await render(<LaunchOfflineScreen profile={{ retry: jest.fn(), retrying: false }} />);

    expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in again" })).toBeNull();
  });

  it("Try again asks for her profile again, not for a session restore", async () => {
    const retry = jest.fn();
    await render(<LaunchOfflineScreen profile={{ retry, retrying: false }} />);

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().launchRetryRequests).toBe(0);
  });

  it("Try again shows it is busy while her profile is being asked for", async () => {
    const retry = jest.fn();
    await render(<LaunchOfflineScreen profile={{ retry, retrying: true }} />);

    const button = screen.getByRole("button", { name: "Try again" });
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await fireEvent.press(button);
    expect(retry).not.toHaveBeenCalled();
  });
});

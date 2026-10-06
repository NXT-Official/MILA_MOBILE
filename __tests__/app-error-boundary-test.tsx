import * as Sentry from "@sentry/react-native";
import { fireEvent, render } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import { AppErrorBoundary } from "@/components/feedback/AppErrorBoundary";

/**
 * Without a boundary, a render error anywhere in the tree closes a release
 * build outright. expo-router's own fallback is a black screen that prints
 * `Error: <message>` — raw error text, off-brand — so the app supplies its own:
 * plain language, one way forward, and the error still reaches crash reporting
 * (a caught error never gets to React's uncaught-error handler, which is how
 * Sentry heard about crashes before).
 */

jest.mock("@sentry/react-native", () => ({ captureException: jest.fn() }));
jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn() }));

const capture = jest.mocked(Sentry.captureException);
const hideSplash = jest.mocked(SplashScreen.hideAsync);
const crash = new Error("Cannot read properties of undefined (reading 'season')");

beforeEach(() => {
  jest.clearAllMocks();
  hideSplash.mockResolvedValue(undefined);
});

test("tells her in plain language and offers a way forward", async () => {
  const screen = await render(<AppErrorBoundary error={crash} retry={jest.fn()} />);

  expect(screen.getByText("Something went wrong")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

test("never shows the raw error text", async () => {
  const screen = await render(<AppErrorBoundary error={crash} retry={jest.fn()} />);

  expect(screen.queryByText(/Cannot read properties/)).toBeNull();
  expect(screen.queryByText(/season/)).toBeNull();
  expect(screen.queryByText(/^Error:/)).toBeNull();
});

test("retry asks the router to render the screen again", async () => {
  const retry = jest.fn();
  const screen = await render(<AppErrorBoundary error={crash} retry={retry} />);

  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

  expect(retry).toHaveBeenCalledTimes(1);
});

/**
 * The root layout holds the native splash until `RootNavigator` hides it. A
 * screen that throws on the first render replaces that tree with this one, so
 * the hide never runs — and the retry screen would sit behind a splash that
 * never closes.
 */
test("closes the splash so the retry screen is visible on a cold start", async () => {
  await render(<AppErrorBoundary error={crash} retry={jest.fn()} />);

  expect(hideSplash).toHaveBeenCalledTimes(1);
});

test("a splash that cannot be hidden still leaves the retry screen standing", async () => {
  hideSplash.mockRejectedValue(new Error("No native splash screen registered"));

  const screen = await render(<AppErrorBoundary error={crash} retry={jest.fn()} />);
  await screen.rerender(<AppErrorBoundary error={crash} retry={jest.fn()} />);

  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

test("reports the error once, and again for a different one", async () => {
  const screen = await render(<AppErrorBoundary error={crash} retry={jest.fn()} />);
  await screen.rerender(<AppErrorBoundary error={crash} retry={jest.fn()} />);

  expect(capture).toHaveBeenCalledTimes(1);
  expect(capture).toHaveBeenCalledWith(crash);

  const next = new Error("another failure");
  await screen.rerender(<AppErrorBoundary error={next} retry={jest.fn()} />);

  expect(capture).toHaveBeenCalledTimes(2);
  expect(capture).toHaveBeenLastCalledWith(next);
});

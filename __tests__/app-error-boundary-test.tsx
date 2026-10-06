import * as Sentry from "@sentry/react-native";
import { fireEvent, render } from "@testing-library/react-native";

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

const capture = jest.mocked(Sentry.captureException);
const crash = new Error("Cannot read properties of undefined (reading 'season')");

beforeEach(() => {
  jest.clearAllMocks();
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

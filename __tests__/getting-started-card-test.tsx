import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render } from "@testing-library/react-native";

import { GettingStartedCard } from "@/features/dashboard/components/GettingStartedCard";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

/**
 * The card sits above the hero, so it must not render until the dismissal has
 * been read: a member who dismissed it saw it flash on every Home mount, and
 * the hero jumped up when it vanished.
 */

const input = { profilePercent: 40, hasPhotoConsent: false, hasComposedLook: false };
const TITLE = "Three things to do first";

function deferredRead() {
  let resolve: (value: string | null) => void = () => {};
  jest.spyOn(AsyncStorage, "getItem").mockImplementation(
    () =>
      new Promise<string | null>((r) => {
        resolve = r;
      }),
  );
  return (value: string | null) => resolve(value);
}

afterEach(() => jest.restoreAllMocks());

// spyOn returns AsyncStorage's own jest.fn, whose calls and overrides would
// otherwise carry from one test into the next.
beforeEach(() => {
  jest.mocked(AsyncStorage.getItem).mockClear();
  jest.mocked(AsyncStorage.setItem).mockReset();
});

test("a dismissed card never appears, not even while storage is read", async () => {
  const answer = deferredRead();
  const s = await render(<GettingStartedCard {...input} />);
  expect(s.queryByText(TITLE)).toBeNull();

  await act(async () => answer("1"));
  expect(s.queryByText(TITLE)).toBeNull();
});

test("a card that was never dismissed appears once storage answers", async () => {
  const answer = deferredRead();
  const s = await render(<GettingStartedCard {...input} />);

  await act(async () => answer(null));
  expect(s.getByText(TITLE)).toBeTruthy();
});

// ── Adversarial: try to make the card crash, flash, or lie ───────────────────

const KEY = "mila.getting-started.dismissed";

test("storage that throws on read shows the card instead of crashing Home", async () => {
  jest.spyOn(AsyncStorage, "getItem").mockImplementation(() => {
    throw new Error("storage unavailable");
  });
  const s = await render(<GettingStartedCard {...input} />);
  await act(async () => {});
  expect(s.getByText(TITLE)).toBeTruthy();
});

test("storage that rejects on read shows the card instead of crashing Home", async () => {
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("disk full"));
  const s = await render(<GettingStartedCard {...input} />);
  await act(async () => {});
  expect(s.getByText(TITLE)).toBeTruthy();
});

test.each(["true", "0", "", "yes", " 1"])("a stored %j is not a dismissal", async (value) => {
  const answer = deferredRead();
  const s = await render(<GettingStartedCard {...input} />);
  await act(async () => answer(value));
  expect(s.getByText(TITLE)).toBeTruthy();
});

// The `alive` guard itself is not observable: React 19 no longer reports a
// state update after unmount, so this pins only what a member could notice.
test("leaving Home before storage answers neither crashes nor logs an error", async () => {
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  const answer = deferredRead();
  const s = await render(<GettingStartedCard {...input} />);
  await s.unmount();
  await act(async () => answer(null));
  expect(errors).not.toHaveBeenCalled();
});

test("dismissing hides the card at once and remembers it", async () => {
  const answer = deferredRead();
  const setItem = jest.spyOn(AsyncStorage, "setItem");
  const s = await render(<GettingStartedCard {...input} />);
  await act(async () => answer(null));

  await fireEvent.press(s.getByLabelText("Dismiss getting started"));

  expect(s.queryByText(TITLE)).toBeNull();
  expect(setItem).toHaveBeenCalledWith(KEY, "1");
});

test("a dismissal that fails to save still hides the card and raises nothing", async () => {
  const answer = deferredRead();
  jest.spyOn(AsyncStorage, "setItem").mockRejectedValue(new Error("disk full"));
  const unhandled = jest.fn();
  process.on("unhandledRejection", unhandled);
  try {
    const s = await render(<GettingStartedCard {...input} />);
    await act(async () => answer(null));
    await fireEvent.press(s.getByLabelText("Dismiss getting started"));
    await act(async () => new Promise((r) => setTimeout(r, 0)));

    expect(s.queryByText(TITLE)).toBeNull();
    expect(unhandled).not.toHaveBeenCalled();
  } finally {
    process.off("unhandledRejection", unhandled);
  }
});

test("Home re-rendering with new props while storage is still read does not flash the card", async () => {
  const answer = deferredRead();
  const s = await render(<GettingStartedCard {...input} />);
  await s.rerender(<GettingStartedCard {...input} profilePercent={80} />);
  await s.rerender(<GettingStartedCard {...input} hasPhotoConsent />);
  expect(s.queryByText(TITLE)).toBeNull();

  await act(async () => answer("1"));
  expect(s.queryByText(TITLE)).toBeNull();
});

test("a member with every step done never sees the card, whatever storage says", async () => {
  const answer = deferredRead();
  const s = await render(
    <GettingStartedCard profilePercent={100} hasPhotoConsent hasComposedLook />,
  );
  await act(async () => answer(null));
  expect(s.queryByText(TITLE)).toBeNull();
});

test("storage is read once per mount, not on every re-render", async () => {
  const answer = deferredRead();
  const s = await render(<GettingStartedCard {...input} />);
  await act(async () => answer(null));
  await s.rerender(<GettingStartedCard {...input} profilePercent={60} />);
  await s.rerender(<GettingStartedCard {...input} profilePercent={70} />);
  const reads = jest.mocked(AsyncStorage.getItem).mock.calls.filter(([key]) => key === KEY);
  expect(reads).toHaveLength(1);
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";

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

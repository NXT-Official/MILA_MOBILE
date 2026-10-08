import { render } from "@testing-library/react-native";
import { BackHandler, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

/**
 * `Sheet` drives an imperative modal from a declarative `visible` prop, and the
 * order of those imperative calls is load-bearing.
 *
 * `BottomSheetModal.handleDismiss` has no early exit for its `INITIAL` status,
 * so a dismiss on a sheet that was never presented parks it at `DISMISSING` —
 * a state `handlePortalRender` refuses to render out of, permanently. A sheet
 * that dismisses on mount therefore never shows again, which is what took out
 * every confirmation in the app.
 *
 * The library is mocked down to the ref: what is under test is the call
 * sequence `Sheet` produces, not the sheet's own animation. The `jest.fn()`s
 * are created inside the factory and read back off the module, because
 * `jest.mock` is hoisted above every `const` in this file.
 */
jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef, useImperativeHandle } = require("react");
  const calls = { present: jest.fn(), dismiss: jest.fn() };

  return {
    __calls: calls,
    BottomSheetModal: forwardRef(function BottomSheetModal(
      { children }: { children: React.ReactNode },
      ref: React.Ref<unknown>,
    ) {
      useImperativeHandle(ref, () => calls);
      return children;
    }),
    BottomSheetScrollView: ({ children }: { children: React.ReactNode }) => children,
    BottomSheetBackdrop: () => null,
  };
});

import * as bottomSheet from "@gorhom/bottom-sheet";

import { Sheet } from "@/components/ui/Sheet";

const { present, dismiss } = (
  bottomSheet as unknown as { __calls: { present: jest.Mock; dismiss: jest.Mock } }
).__calls;

const noop = () => {};

// `useSafeAreaInsets` throws without a provider, and a real one needs a layout
// event to resolve. `initialMetrics` short-circuits that.
const sheet = (visible: boolean) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 360, height: 800 },
      insets: { top: 24, left: 0, right: 0, bottom: 16 },
    }}
  >
    <Sheet visible={visible} onClose={noop} title="Sign out?">
      <Text>body</Text>
    </Sheet>
  </SafeAreaProvider>
);

beforeEach(() => {
  present.mockClear();
  dismiss.mockClear();
});

// `render` and `rerender` are both async in RNTL 14 — see the note in
// `ui-primitives-test`.
test("a sheet that mounts closed does not dismiss itself", async () => {
  await render(sheet(false));
  expect(dismiss).not.toHaveBeenCalled();
});

test("opening presents, and closing an open sheet dismisses", async () => {
  const s = await render(sheet(false));

  await s.rerender(sheet(true));
  expect(present).toHaveBeenCalledTimes(1);
  expect(dismiss).not.toHaveBeenCalled();

  await s.rerender(sheet(false));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

type BackListener = (() => boolean | null | undefined) | undefined;

/** Registers the sheet, then digs the hardware-back handler out of the spy. */
async function backHandlerFor(visible: boolean, renderSheet: () => Promise<unknown>) {
  const spy = jest.spyOn(BackHandler, "addEventListener");
  await renderSheet();
  const call = spy.mock.calls.find(([eventName]) => eventName === "hardwareBackPress");
  spy.mockRestore();
  return call?.[1] as BackListener;
}

describe("Android Back closes the sheet, and only the sheet (MMM-A1)", () => {
  test("Back while the sheet is up dismisses it and is consumed", async () => {
    const handler = await backHandlerFor(true, () => render(sheet(true)));
    expect(handler).toBeTruthy();

    const handled = handler?.();
    expect(handled).toBe(true);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  test("Back with the sheet closed is left to the app underneath", async () => {
    const handler = await backHandlerFor(false, () => render(sheet(false)));
    expect(handler).toBeUndefined();
    expect(dismiss).not.toHaveBeenCalled();
  });
});

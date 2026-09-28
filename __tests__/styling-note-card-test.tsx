import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

/**
 * The styling note's two contracts: every named item carries a visual — the
 * drawing for a piece, the swatch for a colour — and every row is a button
 * that opens the item at detail size.
 *
 * The bottom-sheet library is mocked down to its ref, as in
 * `sheet-present-test`: what is under test is the call sequence the card
 * produces, not the sheet's animation. The `jest.fn()`s live inside the
 * factory because `jest.mock` is hoisted above every `const` in this file.
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

import { MAKEUP_HARMONY, SILHOUETTE_STRATEGY } from "@/constants/style-profile";
import { StylingNoteCard } from "@/features/studio/components/StylingNoteCard";

const { present, dismiss } = (
  bottomSheet as unknown as { __calls: { present: jest.Mock; dismiss: jest.Mock } }
).__calls;

beforeEach(() => {
  present.mockClear();
  dismiss.mockClear();
});

// `useSafeAreaInsets` throws without a provider, and a real one needs a layout
// event to resolve. `initialMetrics` short-circuits that.
const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

/** The row-size item drawings, told apart from icon glyphs by their box. */
const drawings = (s: Awaited<ReturnType<typeof render>>) =>
  s.root?.queryAll(
    (node) => node.type.startsWith("RNSVGSvgView") && node.props.width === 36,
  ) ?? [];

describe("StylingNoteCard", () => {
  it("draws each item that has no colour of its own", async () => {
    const s = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <StylingNoteCard
          title="Silhouette strategy"
          directive={SILHOUETTE_STRATEGY.Hourglass}
          rationale={{ label: "silhouette", value: "Hourglass" }}
        />
      </SafeAreaProvider>,
    );

    // The rationale line connects the advice to the input it derives from.
    expect(s.getByText("Because your silhouette is Hourglass")).toBeTruthy();
    // Three named items, three drawings.
    expect(drawings(s)).toHaveLength(SILHOUETTE_STRATEGY.Hourglass.items.length);
  });

  it("keeps colours as swatches rather than drawings", async () => {
    const s = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <StylingNoteCard
          title="Makeup harmony"
          directive={MAKEUP_HARMONY.Spring}
          rationale={{ label: "palette" }}
        />
      </SafeAreaProvider>,
    );

    expect(drawings(s)).toHaveLength(0);
  });

  it("opens each row's detail sheet, and mounts closed", async () => {
    const s = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <StylingNoteCard
          title="Silhouette strategy"
          directive={SILHOUETTE_STRATEGY.Hourglass}
          rationale={{ label: "silhouette", value: "Hourglass" }}
        />
      </SafeAreaProvider>,
    );

    // Mounting must not dismiss — the wedged-sheet failure the Sheet primitive
    // documents.
    expect(dismiss).not.toHaveBeenCalled();

    await fireEvent.press(s.getByRole("button", { name: /^Wrap dresses\./ }));
    expect(present).toHaveBeenCalledTimes(1);

    await fireEvent.press(s.getByRole("button", { name: /^Belted knits\./ }));
    // The sheet is already up; swapping the item must not re-present it.
    expect(present).toHaveBeenCalledTimes(1);
  });
});

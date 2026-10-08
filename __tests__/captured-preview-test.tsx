import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

/**
 * The review step after a Lens or Dupe Hunter capture. Its buttons sit at the
 * very bottom of the screen, so they must clear the phone's own navigation bar:
 * on an edge-to-edge Android build Retake was drawn under the system buttons
 * and could not be pressed.
 */
const NAV_BAR = 48;

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: NAV_BAR, left: 0, right: 0 }),
}));
jest.mock("expo-image", () => ({ Image: () => null }));

import { spacing } from "@/theme/tokens";
import { CapturedPreview } from "@/features/lens/components/CapturedPreview";

const PHOTO = { uri: "file:///capture.jpg", width: 1440, height: 1920 };

function preview(budget?: { value: string; onChange: (next: string) => void }) {
  return render(
    <CapturedPreview
      photo={PHOTO}
      error={null}
      busy={false}
      blockedMessage={null}
      actionLabel="Hunt the dupes"
      budget={budget}
      onRetake={jest.fn()}
      onAnalyse={jest.fn()}
    />,
  );
}

type Rendered = ReturnType<Awaited<ReturnType<typeof render>>["getByText"]>;

/** The nearest ancestor that sets a bottom padding, and that padding. */
function bottomPaddingAbove(node: Rendered) {
  for (let current = node.parent; current; current = current.parent) {
    const style = StyleSheet.flatten(current.props.style) as { paddingBottom?: number } | undefined;
    if (typeof style?.paddingBottom === "number") return style.paddingBottom;
  }
  return 0;
}

describe("CapturedPreview clears the phone's navigation bar", () => {
  it("Retake sits above the system buttons", async () => {
    const s = await preview();
    expect(bottomPaddingAbove(s.getByText("Retake"))).toBe(NAV_BAR + spacing.lg);
  });

  it("with the Dupe Hunter budget field shown, Retake still clears them", async () => {
    const s = await preview({ value: "", onChange: jest.fn() });
    expect(s.getByText("Max budget (optional)")).toBeTruthy();
    expect(bottomPaddingAbove(s.getByText("Retake"))).toBe(NAV_BAR + spacing.lg);
  });

  it("the main action shares the same cleared area", async () => {
    const s = await preview();
    expect(bottomPaddingAbove(s.getByText("Hunt the dupes"))).toBe(NAV_BAR + spacing.lg);
  });
});

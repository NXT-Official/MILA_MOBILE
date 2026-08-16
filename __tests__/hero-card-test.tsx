import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { HeroCard } from "@/features/dashboard/components/HeroCard";

/**
 * A regression pin, not a rendering test.
 *
 * `react-native-svg`'s Android `SvgView.hitTest()` returns its **own** view id
 * whenever the SVG holds no touchable children, so an absolutely-filled
 * gradient claims every touch inside the card. When that guard went missing the
 * whole hero went dead — the city picker, the mood select, and the compose
 * button — with nothing on screen to suggest why. It has already been lost once
 * in a commit, which is the reason this file exists.
 *
 * `fireEvent.press` dispatches straight at an element and does not model
 * hit-testing, so it would pass with the bug present. The structural assertion
 * is the one that actually fails if the guard is removed.
 */

describe("HeroCard", () => {
  it("keeps the gradient out of hit-testing so its children stay pressable", async () => {
    const s = await render(
      <HeroCard>
        <Text>Good morning.</Text>
      </HeroCard>,
    );

    expect(s.getByTestId("hero-gradient").props.pointerEvents).toBe("none");
  });
});

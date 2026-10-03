jest.mock("../src/features/onboarding/components/PersonalColorCapture", () =>
  require("../src/test-utils/personal-color-capture-mock"),
);

import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ColorPath } from "@/features/onboarding/steps/ColorPath";

/** StepShell reads the insets; `initialMetrics` short-circuits the async fetch. */
const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

/**
 * The colour path gained a second door: the live camera read. What this pins is
 * the wiring — tile opens the overlay, the overlay's answer becomes the
 * candidate — plus that the manual path never left.
 */
async function mount(onCandidateReady = jest.fn()) {
  const screen = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ColorPath
        existingDossier={null}
        onBack={jest.fn()}
        onCandidateReady={onCandidateReady}
        onContinueExisting={jest.fn()}
      />
    </SafeAreaProvider>,
  );
  return { screen, onCandidateReady };
}

test("the colour path offers the live camera read and the manual path", async () => {
  const { screen } = await mount();
  expect(screen.getByText("Analyze my coloring")).toBeTruthy();
  expect(screen.getByText("I know my season")).toBeTruthy();
});

test("opening the live read mounts the overlay; completing it hands the profile on", async () => {
  const { screen, onCandidateReady } = await mount();

  await fireEvent.press(screen.getByText("Analyze my coloring"));
  expect(screen.getByText("stub capture overlay")).toBeTruthy();

  await fireEvent.press(screen.getByLabelText("stub complete"));
  expect(onCandidateReady).toHaveBeenCalledWith({ season: "Spring" });
});

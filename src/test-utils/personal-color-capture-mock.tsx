import { Pressable, Text } from "react-native";

/**
 * The colour-read overlay, stood in for by `color-path-camera-test.tsx`.
 *
 * A real helper module rather than an inline `jest.mock` factory: nativewind's
 * transform rewrites `require`/`createElement` inside factories, so JSX there
 * throws "out-of-scope variables" — see `captcha-gate-mock.tsx` for the same
 * pattern.
 */
export function PersonalColorCapture({
  onComplete,
}: {
  onClose: () => void;
  onComplete: (profile: unknown) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="stub complete"
      onPress={() => onComplete({ season: "Spring" })}
    >
      <Text>stub capture overlay</Text>
    </Pressable>
  );
}

import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { cn } from "@/utils/cn";

/**
 * A placeholder that mirrors the shape it will become. Never a spinner (§10):
 * a skeleton tells the member what is arriving, a spinner only says "wait".
 *
 * Size comes from the caller's layout classes — that is composition, not a
 * restyle, because a skeleton has no intrinsic dimensions to own.
 */
export function Skeleton({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0.45);

  useEffect(() => {
    if (reduceMotion) {
      // The affordance stays — a static wash still reads as "not content yet".
      progress.value = 0.45;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
      -1,
      true,
    );
  }, [progress, reduceMotion]);

  // Case 2 of the StyleSheet exceptions: a Reanimated animated style.
  const animatedStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={animatedStyle}
      className={cn("rounded-control bg-surface-alt", className)}
    />
  );
}

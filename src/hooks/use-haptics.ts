import * as Haptics from "expo-haptics";

/**
 * The two feedback moments §4 allows: `Light` on a selection or tab change,
 * `Success` when a look is generated or saved. Nothing celebratory — the brand
 * forbids it, so there is no `warning`, no `heavy`, and no error buzz here.
 *
 * Every call is fire-and-forget. A device with no haptic motor rejects the
 * promise, and a failed vibration is never worth surfacing to a member.
 */
export function useHaptics() {
  return {
    selection: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    success: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
  };
}

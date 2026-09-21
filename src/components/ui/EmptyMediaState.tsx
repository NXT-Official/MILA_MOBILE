import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";

/**
 * The frame a visual lands in when there is nothing to draw — the web's
 * `empty-media-state.tsx`. Dashed, never the solid border a real image frame
 * wears, so an empty slot cannot read as an image that failed to load.
 */
export function EmptyMediaState({
  message,
  action,
  aspect = "portrait",
}: {
  message: string;
  action?: ReactNode;
  /** `video` for the style sheet's wide turnaround, `portrait` for a photo. */
  aspect?: "video" | "portrait";
}) {
  return (
    <View
      className={
        aspect === "video"
          ? "aspect-video w-full items-center justify-center gap-md rounded-card border border-dashed border-border bg-surface px-xl dark:border-border/12"
          : "aspect-[3/4] w-full items-center justify-center gap-md rounded-card border border-dashed border-border bg-surface px-xl dark:border-border/12"
      }
    >
      <Icon name="imageOff" size="md" color="muted" />
      <Text className="font-body text-sm text-body text-center">{message}</Text>
      {action}
    </View>
  );
}

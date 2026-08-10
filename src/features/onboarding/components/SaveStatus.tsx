import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";

export type SaveState = "idle" | "saving" | "saved" | "dirty" | "error";

const COPY: Record<SaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Progress saved",
  dirty: "Not saved yet",
  error: "We couldn't save that",
};

/**
 * Autosave made visible. The failure state is the important one: it says the
 * answer is still here, and offers a retry — it never discards the selection
 * and never shows a raw error code.
 *
 * Every state carries an icon and a word, so the difference between saved and
 * failed is never colour alone.
 */
export function SaveStatus({ state, onRetry }: { state: SaveState; onRetry?: () => void }) {
  if (state === "idle") return null;

  return (
    <View accessibilityLiveRegion="polite" className="flex-row items-center gap-sm">
      {state === "saving" ? <ActivityIndicator size="small" /> : null}
      {state === "saved" ? <Icon name="saved" size="xs" color="success" /> : null}
      {state === "dirty" ? <Icon name="unsaved" size="xs" color="muted" /> : null}
      {state === "error" ? <Icon name="unsaved" size="xs" color="destructive" /> : null}

      <Text
        className={`font-body text-micro ${state === "error" ? "text-destructive" : "text-muted"}`}
      >
        {COPY[state]}
      </Text>

      {state === "error" && onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry saving"
          onPress={onRetry}
          hitSlop={12}
          className="flex-row items-center gap-xs"
        >
          <Icon name="retry" size="xs" color="ink" />
          <Text className="font-body-medium text-micro text-ink underline">Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

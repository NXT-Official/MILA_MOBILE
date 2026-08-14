import { router } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

import { CreditCostHint } from "./CreditCostHint";

const NO_VISUAL_COPY = "Your look needs its visual before it can be saved.";

/**
 * What she can do with a finished look. "Ask Mila" joins this row in Phase 07 —
 * it is absent rather than disabled, because a button that cannot do anything
 * is a worse answer than no button.
 */
export function LookActions({
  hasVisual,
  saved,
  saving,
  saveError,
  onSave,
  onRegenerate,
  regenerating,
}: {
  hasVisual: boolean;
  saved: boolean;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <View className="gap-md">
      {saved ? (
        <Button
          label="View in History"
          variant="secondary"
          onPress={() => router.push("/history")}
        />
      ) : (
        <Button
          label="Save to history"
          disabled={!hasVisual}
          loading={saving}
          onPress={onSave}
        />
      )}

      {!hasVisual && !saved ? (
        <View accessibilityLiveRegion="polite" className="flex-row items-start gap-sm">
          <View className="mt-xs">
            <Icon name="alert" size="xs" color="muted" />
          </View>
          <Text className="flex-1 font-body text-sm text-body">{NO_VISUAL_COPY}</Text>
        </View>
      ) : null}

      {saveError ? (
        <Text accessibilityLiveRegion="assertive" className="font-body text-sm text-body">
          {saveError}
        </Text>
      ) : null}

      {hasVisual ? (
        <View className="gap-xs">
          <Button
            label="New visual"
            variant="secondary"
            loading={regenerating}
            onPress={onRegenerate}
          />
          {/* The charge is named before the tap, not discovered after it. The
              first visual claimed the pending flag from /look/generate; every
              one after it costs a credit. */}
          <CreditCostHint credits={1} />
        </View>
      ) : null}
    </View>
  );
}

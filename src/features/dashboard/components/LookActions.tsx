import { router } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

import { CreditCostHint } from "./CreditCostHint";

const NO_VISUAL_COPY = "Your look needs its visual before it can be saved.";

/**
 * What she can do with a finished look — the web's hero action row
 * (`hero-result-panel.tsx`): Save to history, New visual, Try another look, and
 * Ask Mila once the look is saved.
 *
 * "New visual" is gated on photo consent because the sheet renders from her
 * consented selfie; without one the slot above says so instead. "Ask Mila"
 * anchors the *saved* look, so it appears only after a save — a button that
 * cannot do anything is a worse answer than no button.
 */
export function LookActions({
  hasVisual,
  saved,
  saving,
  saveError,
  canRenderVisual,
  newVisualLoading,
  tryAnotherDisabled,
  canAskMila,
  onSave,
  onNewVisual,
  onTryAnother,
  onAskConcierge,
}: {
  hasVisual: boolean;
  saved: boolean;
  saving: boolean;
  saveError: string | null;
  /** Photo consent — gates the style-sheet controls. */
  canRenderVisual: boolean;
  newVisualLoading: boolean;
  /**
   * A new look charges a credit, so this follows the primary CTA: off while a
   * look or its visual is still on its way, and for whatever blocks the CTA.
   */
  tryAnotherDisabled: boolean;
  /** True once the look has a saved row to anchor. */
  canAskMila: boolean;
  onSave: () => void;
  onNewVisual: () => void;
  onTryAnother: () => void;
  onAskConcierge: () => void;
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

      {canRenderVisual ? (
        <Button
          label="New visual"
          variant="secondary"
          loading={newVisualLoading}
          onPress={onNewVisual}
        />
      ) : null}

      <Button
        label="Try another look"
        variant="secondary"
        disabled={tryAnotherDisabled}
        onPress={onTryAnother}
      />

      {canAskMila ? (
        <Button label="Ask Mila about this look" variant="secondary" onPress={onAskConcierge} />
      ) : null}

      {/* The web's line, at the foot of its action row — one disclosure for
          every action above that charges. */}
      <View className="flex-row items-center gap-xs">
        <CreditCostHint credits={1} />
        <Text className="font-body text-micro text-muted">
          per new look or visual
        </Text>
      </View>
    </View>
  );
}

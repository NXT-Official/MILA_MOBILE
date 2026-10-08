import { router } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";

import { CreditCostHint } from "./CreditCostHint";

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
  saved,
  saving,
  saveError,
  canRenderVisual,
  newVisualLoading,
  canAskMila,
  onSave,
  onNewVisual,
  onTryAnother,
  onAskConcierge,
}: {
  saved: boolean;
  saving: boolean;
  saveError: string | null;
  /** Photo consent — gates the style-sheet controls. */
  canRenderVisual: boolean;
  newVisualLoading: boolean;
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
          // Saving no longer needs a visual first — every generation is
          // auto-saved and this button is the retry path; it only waits while
          // a sheet is drawing so the automatic save can't be doubled.
          disabled={newVisualLoading}
          loading={saving}
          onPress={onSave}
        />
      )}

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

      <Button label="Try another look" variant="secondary" onPress={onTryAnother} />

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

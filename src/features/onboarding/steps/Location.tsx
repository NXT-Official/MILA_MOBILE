import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { HUBS } from "@/constants/climate";
import { suggestNearestHub, type Hub } from "@/services/location";

import { OptionTile } from "../components/OptionTile";
import type { SaveState } from "../components/SaveStatus";
import { StepShell } from "../components/StepShell";

const DENIED_COPY =
  "No problem — location stays off. Pick the city closest to you and Mila will use its weather.";
const UNAVAILABLE_COPY =
  "We couldn't get a fix just now. Pick the city closest to you instead — it works just as well.";

/**
 * Optional. Two ways to answer: the ten hubs, or the device.
 *
 * The device path never saves on its own — it selects the nearest hub and shows
 * it for confirmation, because a location written silently is a location she
 * never agreed to (§7). Permission denial is a normal path: it changes one line
 * of copy and nothing else.
 */
export function Location({
  value,
  onBack,
  onSaved,
  onSkip,
  save,
  saveState,
  onRetrySave,
  saving,
}: {
  value: string | null;
  onBack: () => void;
  onSaved: () => void;
  onSkip: () => void;
  save: (hubId: string) => Promise<boolean>;
  saveState: SaveState;
  onRetrySave: () => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(value);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<Hub | null>(null);

  async function handleUseMyLocation() {
    setLocating(true);
    setNotice(null);
    setSuggested(null);
    const result = await suggestNearestHub();
    setLocating(false);

    if (result.status === "denied") return setNotice(DENIED_COPY);
    if (result.status === "unavailable") return setNotice(UNAVAILABLE_COPY);

    // Suggest, do not save. She confirms below.
    setSuggested(result.hub);
    setSelected(result.hub.id);
  }

  async function handleSave() {
    if (selected && (await save(selected))) onSaved();
  }

  return (
    <StepShell
      step="location"
      onBack={onBack}
      onContinue={handleSave}
      continueLabel="Set my location"
      continueDisabled={!selected}
      continueLoading={saving}
      onSkip={onSkip}
      saveState={saveState}
      onRetrySave={onRetrySave}
    >
      <View className="gap-lg">
        <Text className="font-body text-base text-body">
          Mila can adapt daily recommendations to your weather. This step is optional — you can set
          it later from your profile.
        </Text>

        <Button
          label={locating ? "Finding your nearest hub…" : "Use my location"}
          variant="secondary"
          loading={locating}
          onPress={handleUseMyLocation}
        />

        {suggested ? (
          <Card>
            <View className="flex-row items-center gap-sm">
              <Icon name="location" size="sm" color="accent" />
              <Text className="font-body-medium text-base text-ink">
                Nearest hub: {suggested.city}
              </Text>
            </View>
            <Text className="font-body text-sm text-body mt-xs">
              Selected below — tap “Set my location” to confirm, or choose a different city.
            </Text>
          </Card>
        ) : null}

        {notice ? (
          <Text accessibilityLiveRegion="polite" className="font-body text-sm text-muted">
            {notice}
          </Text>
        ) : null}

        <View accessibilityRole="radiogroup" className="gap-md">
          {HUBS.map((hub) => (
            <OptionTile
              key={hub.id}
              title={hub.city}
              description={hub.tagline}
              selected={selected === hub.id}
              onPress={() => {
                setSelected(hub.id);
                setSuggested(null);
              }}
            />
          ))}
        </View>
      </View>
    </StepShell>
  );
}

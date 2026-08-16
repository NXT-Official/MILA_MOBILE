import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { SelectRow } from "@/components/ui/SelectRow";
import { Sheet } from "@/components/ui/Sheet";
import { HUBS } from "@/constants/climate";
import { useUpdateStyleProfile } from "@/hooks/use-profile";
import { suggestNearestHub, type Hub } from "@/services/location";

const DENIED_COPY =
  "No problem — location stays off. Pick the city closest to you and Mila will use its weather.";
const UNAVAILABLE_COPY =
  "We couldn't get a fix just now. Pick the city closest to you instead — it works just as well.";
const SAVE_FAILED_COPY = "That didn't save. Check your connection and try again.";

/**
 * Changing the weather hub. The same two paths as onboarding — the ten cities,
 * or the device.
 *
 * The device path suggests and preselects; it never writes. §7 is explicit that
 * a location is not saved without confirmation, so "Set location" is the only
 * thing that writes, on both paths.
 */
export function HubSheet({
  visible,
  onClose,
  currentHubId,
  autoLocate = false,
}: {
  visible: boolean;
  onClose: () => void;
  currentHubId: string | null;
  /** Opened from the dashboard's pin: start the device path without a second tap. */
  autoLocate?: boolean;
}) {
  // Her own pick, or the saved hub until she makes one. Held as an override
  // rather than seeded from the prop: the sheet mounts with the screen, often
  // before the profile query resolves, and a `useState(currentHubId)` initial
  // value would freeze the null and leave the saved city unselected.
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? currentHubId;
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<Hub | null>(null);
  const update = useUpdateStyleProfile();

  async function handleUseMyLocation() {
    setLocating(true);
    setNotice(null);
    setSuggested(null);
    const result = await suggestNearestHub();
    setLocating(false);

    if (result.status === "denied") return setNotice(DENIED_COPY);
    if (result.status === "unavailable") return setNotice(UNAVAILABLE_COPY);

    setSuggested(result.hub);
    setPicked(result.hub.id);
  }

  // Fired once per opening, not once per render: the permission prompt is a
  // system dialog, and asking twice because a parent re-rendered is the kind of
  // thing that gets an app's location access denied for good.
  const located = useRef(false);
  useEffect(() => {
    if (!visible) {
      located.current = false;
      return;
    }
    if (autoLocate && !located.current) {
      located.current = true;
      void handleUseMyLocation();
    }
  }, [visible, autoLocate]);

  function handleSave() {
    if (!selected) return;
    // `default_location` is on the permitted column list (§7); the mutation
    // invalidates the profile key explicitly, and the weather query re-keys off
    // the new hub id on its own.
    update.mutate({ default_location: selected }, { onSuccess: onClose });
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Today's weather">
      <View className="gap-lg">
        <Text className="font-body text-base text-body">
          Mila styles for the weather where you are. Choose the city closest to you.
        </Text>

        <Button
          label={locating ? "Finding your nearest city…" : "Use my location"}
          variant="secondary"
          loading={locating}
          onPress={handleUseMyLocation}
        />

        {suggested ? (
          <View className="flex-row items-center gap-sm">
            <Icon name="location" size="sm" color="accent" />
            <Text className="flex-1 font-body text-sm text-body">
              Nearest city: {suggested.city}. Tap “Set location” to confirm.
            </Text>
          </View>
        ) : null}

        {notice ? (
          <Text accessibilityLiveRegion="polite" className="font-body text-sm text-muted">
            {notice}
          </Text>
        ) : null}

        {update.isError ? <InlineError message={SAVE_FAILED_COPY} /> : null}

        <View accessibilityRole="radiogroup" className="gap-md">
          {HUBS.map((hub) => (
            <SelectRow
              key={hub.id}
              title={hub.city}
              description={hub.tagline}
              selected={selected === hub.id}
              onPress={() => {
                setPicked(hub.id);
                setSuggested(null);
              }}
            />
          ))}
        </View>

        <Button
          label="Set location"
          disabled={!selected || selected === currentHubId}
          loading={update.isPending}
          onPress={handleSave}
        />
      </View>
    </Sheet>
  );
}

import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";

export type IndoorOutdoor = "Indoor" | "Outdoor" | "Mixed";

export type TodayPlan = {
  agenda: string;
  dressCode: string;
  indoorOutdoor: IndoorOutdoor | "";
};

export const EMPTY_TODAY_PLAN: TodayPlan = { agenda: "", dressCode: "", indoorOutdoor: "" };

const SETTINGS: IndoorOutdoor[] = ["Indoor", "Outdoor", "Mixed"];

/**
 * The web's three optional hero-form fields — "Today's plan", "Dress code",
 * and "Setting" — as one collapsible block.
 *
 * The web spreads them across a four-column grid beside the mood select; a
 * 360dp column cannot do that without shrinking every field below a usable tap
 * target, so they fold behind one row that shows what has been filled in. The
 * labels, placeholders, and max lengths are the web's, verbatim — the server
 * validates against the same 200/80 characters.
 */
export function TodayPlanFields({
  value,
  onChange,
}: {
  value: TodayPlan;
  onChange: (next: TodayPlan) => void;
}) {
  const [open, setOpen] = useState(false);

  const summary = [value.agenda.trim(), value.dressCode.trim(), value.indoorOutdoor]
    .filter(Boolean)
    .join(" · ");

  function set<K extends keyof TodayPlan>(key: K, next: TodayPlan[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <View className="gap-md">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Today's plan, optional"
        onPress={() => setOpen((v) => !v)}
        className="min-h-tap flex-row items-center justify-between gap-md"
      >
        <View className="flex-1">
          <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
            Today&apos;s plan (optional)
          </Text>
          {summary && !open ? (
            <Text className="font-body text-sm text-body" numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Icon name={open ? "chevronDown" : "chevronRight"} size="sm" color="muted" />
      </Pressable>

      {open ? (
        <View className="gap-md">
          <View className="gap-sm">
            <Text className="font-body text-sm text-body">Agenda</Text>
            <TextInput
              value={value.agenda}
              onChangeText={(next) => set("agenda", next)}
              placeholder="e.g. Client dinner at 7pm"
              placeholderTextColor="#9A8F86"
              maxLength={200}
              accessibilityLabel="Today's plan"
              className="min-h-tap rounded-pill border border-border bg-surface px-lg font-body text-sm text-ink dark:border-border/12"
            />
          </View>

          <View className="gap-sm">
            <Text className="font-body text-sm text-body">Dress code</Text>
            <TextInput
              value={value.dressCode}
              onChangeText={(next) => set("dressCode", next)}
              placeholder="e.g. Smart casual"
              placeholderTextColor="#9A8F86"
              maxLength={80}
              accessibilityLabel="Dress code"
              className="min-h-tap rounded-pill border border-border bg-surface px-lg font-body text-sm text-ink dark:border-border/12"
            />
          </View>

          <View className="gap-sm">
            <Text className="font-body text-sm text-body">Setting</Text>
            <View className="flex-row flex-wrap gap-sm">
              {SETTINGS.map((setting) => (
                <Chip
                  key={setting}
                  label={setting}
                  selected={value.indoorOutdoor === setting}
                  // Tapping the active chip clears it: the web's select has no
                  // clear control, and on mobile a chosen setting that cannot be
                  // un-chosen is a trap.
                  onPress={() => set("indoorOutdoor", value.indoorOutdoor === setting ? "" : setting)}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

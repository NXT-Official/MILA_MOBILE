import { Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The web dashboard's stat tiles, minus the two mobile carries elsewhere:
 * credits sit in the app header's pill on every screen, and the day streak is
 * excluded by §10's anti-reference rules (no gamification, no streaks) — both
 * are deliberate omissions, not drift.
 *
 * No endpoint: "Style Profile %" is the same nine-field score the web computes
 * (`lib/dashboard-stats.ts`) and "Looks this month" is counted off the rows
 * History already reads.
 */
export function StatsRow({
  profilePercent,
  profileLoading,
  looksThisMonth,
  looksLoading,
}: {
  profilePercent: number;
  profileLoading: boolean;
  looksThisMonth: number;
  looksLoading: boolean;
}) {
  return (
    <View className="flex-row gap-md">
      <StatTile
        icon="sparkle"
        label="Style Profile"
        value={`${profilePercent}%`}
        loading={profileLoading}
      />
      <StatTile
        icon="outfit"
        label="Looks this month"
        value={String(looksThisMonth)}
        loading={looksLoading}
      />
    </View>
  );
}

function StatTile({
  icon,
  label,
  value,
  loading,
}: {
  icon: IconName;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card className="flex-1 gap-md p-lg">
      <View className="flex-row items-center gap-sm">
        <Icon name={icon} size="sm" color="muted" />
        <Text className="font-body-semibold text-micro tracking-label uppercase text-muted">
          {label}
        </Text>
      </View>

      {loading ? (
        <Skeleton className="h-7 w-1/2" />
      ) : (
        <Text className="font-display text-h3 text-ink">{value}</Text>
      )}
    </Card>
  );
}

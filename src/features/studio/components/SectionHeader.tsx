import { Text, View } from "react-native";

/** Eyebrow + title + optional subtitle. One header shape for every section. */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="gap-xs">
      <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
        {eyebrow}
      </Text>
      <Text
        accessibilityRole="header"
        className="font-display text-h3 tracking-heading text-ink"
      >
        {title}
      </Text>
      {subtitle ? <Text className="font-body text-sm text-body">{subtitle}</Text> : null}
    </View>
  );
}

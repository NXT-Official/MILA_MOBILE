import { useState } from "react";
import { LayoutAnimation, Pressable, Text, View } from "react-native";

import { Divider } from "./Divider";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";

export type LookSection = { title: string; body: string };

/**
 * The written look — Outfit, Hair, Makeup — as collapsible sections.
 *
 * The text is the product; the image is an enhancement (§8). So this renders
 * whenever sections exist, including when the visual failed, and it never waits
 * on the image.
 */
export function LookDetail({
  headline,
  sections,
  loading,
}: {
  headline: string | null;
  sections: LookSection[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <View className="gap-lg">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
        <View className="gap-md">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-6 w-1/3" />
        </View>
      </View>
    );
  }

  if (!headline || sections.length === 0) return null;

  return (
    <View className="gap-lg">
      <Text accessibilityRole="header" className="font-display text-h2 tracking-heading text-ink">
        {headline}
      </Text>
      <View>
        {sections.map((section) => (
          <CollapsibleSection key={section.title} section={section} />
        ))}
      </View>
    </View>
  );
}

function CollapsibleSection({ section }: { section: LookSection }) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={section.title}
        onPress={() => {
          // The one layout animation in the app: a disclosure that snaps reads
          // as a bug. `easeInEaseOut` is the platform default and honours the
          // OS reduce-motion setting without a branch here.
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((v) => !v);
        }}
        className="active:opacity-90 min-h-tap flex-row items-center justify-between gap-md py-md"
      >
        <Text className="font-body-semibold text-section tracking-section uppercase text-ink">
          {section.title}
        </Text>
        <Icon name={open ? "chevronDown" : "chevronRight"} size="sm" color="muted" />
      </Pressable>
      {open ? (
        <Text className="font-body text-base text-body pb-md">{section.body}</Text>
      ) : null}
      <Divider />
    </View>
  );
}

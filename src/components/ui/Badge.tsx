import { cva, type VariantProps } from "class-variance-authority";
import { Text, View } from "react-native";

import { cn } from "@/utils/cn";

/**
 * A small static label. Not a chip — nothing here is pressable, and nothing
 * here is a count on an icon.
 *
 * Every variant carries its meaning in the words, never in the fill. The
 * Colour-Is-Content rule (§11) is absolute: a member who cannot separate the
 * accent wash from the neutral one still reads "Most popular".
 */
const badgeVariants = cva("flex-row items-center self-start rounded-pill px-md py-xs", {
  variants: {
    variant: {
      neutral: "bg-surface-alt",
      accent: "bg-accent-soft",
      success: "bg-surface-alt",
    },
  },
  defaultVariants: { variant: "neutral" },
});

const badgeLabelVariants = cva(
  "font-body-semibold text-label tracking-label uppercase",
  {
    variants: {
      variant: {
        neutral: "text-body",
        // Gold is never a text colour (§10) — the wash carries it, ink carries
        // the word.
        accent: "text-ink",
        success: "text-success",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

type BadgeProps = VariantProps<typeof badgeVariants> & {
  label: string;
  className?: string;
};

export function Badge({ label, variant, className }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)}>
      <Text className={cn(badgeLabelVariants({ variant }))}>{label}</Text>
    </View>
  );
}

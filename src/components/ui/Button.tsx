import { cva, type VariantProps } from "class-variance-authority";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

import { cn } from "@/utils/cn";

/**
 * `primary` is bg-ink, not bg-accent. Champagne Gold is an accent, and a
 * full-width gold button would consume far more than the ~10% of screen the One
 * Gold Rule permits. Gold appears on focus rings, active navigation, and
 * selected-state washes.
 */
export const buttonVariants = cva(
  "flex-row items-center justify-center gap-sm rounded-control",
  {
    variants: {
      variant: {
        primary: "bg-ink",
        // The dark `border` token is a light value consumed at 12%; without the
        // modifier the rule renders white in dark mode. Contained in the
        // primitive, so no feature ever writes a `dark:` prefix.
        secondary: "bg-surface border border-border dark:border-border/12",
        outline: "bg-canvas border border-border dark:border-border/12",
        ghost: "bg-transparent",
        destructive: "bg-destructive",
      },
      size: {
        sm: "h-10 px-lg",
        md: "h-12 px-xl", // 48px — the daily-flow default
        lg: "h-14 px-2xl",
        icon: "h-12 w-12 px-0",
        chip: "h-10 px-md rounded-pill",
      },
      disabled: { true: "opacity-50", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", disabled: false },
  },
);

/**
 * Two cva definitions per component — one for the container, one for the text —
 * because React Native does not inherit text colour from a parent View. This is
 * why Button renders its own Text rather than accepting arbitrary children.
 */
export const buttonLabelVariants = cva("font-body", {
  variants: {
    variant: {
      primary: "text-on-ink",
      secondary: "text-ink",
      outline: "text-ink",
      ghost: "text-ink",
      destructive: "text-on-destructive",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
      icon: "",
      chip: "text-label tracking-label uppercase",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export type ButtonProps = Omit<PressableProps, "children" | "disabled" | "style"> &
  VariantProps<typeof buttonVariants> & {
    label: string;
    loading?: boolean;
    className?: string;
  };

export function Button({
  label,
  variant,
  size,
  disabled,
  loading = false,
  className,
  ...rest
}: ButtonProps) {
  const isBlocked = Boolean(disabled) || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      disabled={isBlocked}
      // Pressed state replaces the web's hover lift — hover does not exist.
      style={({ pressed }) =>
        pressed && !isBlocked ? { opacity: 0.9, transform: [{ scale: 0.98 }] } : undefined
      }
      className={cn(buttonVariants({ variant, size, disabled: isBlocked }), className)}
      {...rest}
    >
      {loading ? <ActivityIndicator size="small" /> : null}
      {/* The label stays visible while loading. */}
      <Text className={cn(buttonLabelVariants({ variant, size }))}>{label}</Text>
    </Pressable>
  );
}

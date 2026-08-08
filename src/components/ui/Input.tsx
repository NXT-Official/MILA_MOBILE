import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import { useThemeColor } from "@/theme/tailwind";
import { cn } from "@/utils/cn";

import { Icon } from "./Icon";

const fieldVariants = cva(
  "w-full flex-row items-center rounded-control bg-surface border px-lg font-body text-base text-ink",
  {
    variants: {
      size: {
        md: "h-12", // §11 default
        lg: "h-14", // roomier fields on low-density screens like auth
      },
      state: {
        // Focus adds a 2px accent ring — the one place gold outlines rather
        // than fills. Gold is never the text (§11, Gold-Is-Not-Ink).
        default: "border-border dark:border-border/12",
        focused: "border-accent",
        error: "border-destructive",
      },
    },
    defaultVariants: { size: "md", state: "default" },
  },
);

export type InputProps = Omit<TextInputProps, "style" | "className"> &
  VariantProps<typeof fieldVariants> & {
    label?: string;
    error?: string;
    /** Renders a show/hide toggle and manages secureTextEntry itself. */
    revealable?: boolean;
    className?: string;
  };

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, revealable = false, size, className, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const placeholderColor = useThemeColor("muted");

  const state = error ? "error" : focused ? "focused" : "default";

  return (
    <View className={cn("w-full gap-sm", className)}>
      {label ? (
        <Text className="font-body-medium text-sm text-ink" accessibilityRole="text">
          {label}
        </Text>
      ) : null}

      <View className={cn(fieldVariants({ size, state }))}>
        <TextInput
          ref={ref}
          // Placeholder is `muted`, never lighter — it holds 5.63:1 deliberately.
          placeholderTextColor={placeholderColor}
          secureTextEntry={revealable && !revealed}
          accessibilityLabel={label}
          className="flex-1 font-body text-base text-ink"
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {revealable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={12}
            onPress={() => setRevealed((v) => !v)}
            className="pl-md"
          >
            <Icon name={revealed ? "eyeOff" : "eye"} size="sm" color="muted" />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-body text-sm text-destructive"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});

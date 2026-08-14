import { Text, TextInput, View } from "react-native";

import { useThemeColor } from "@/theme/tailwind";
import { MAX_CAPTION_LENGTH } from "@/services/api/posts";
import { cn } from "@/utils/cn";

/**
 * A multi-line caption with a live counter.
 *
 * Not `components/ui/Input` — that primitive is a single-line field with a fixed
 * height, and a caption is a paragraph. Rather than add a `multiline` variant
 * that changes the primitive's whole layout contract, this composes a plain
 * `TextInput` with the same tokens.
 *
 * `maxLength` enforces the cap at the keyboard rather than on submit, so the
 * limit is felt as a stop and never as a rejected post.
 */
export function CaptionInput({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (next: string) => void;
}) {
  const placeholderColor = useThemeColor("muted");
  const remaining = MAX_CAPTION_LENGTH - value.length;
  // Only the last stretch is worth mentioning; a counter that shouts from
  // character one is a nag.
  const nearLimit = remaining <= 50;

  return (
    <View className="w-full gap-sm">
      <Text className="font-body-medium text-sm text-ink">Caption</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={MAX_CAPTION_LENGTH}
        textAlignVertical="top"
        placeholder="What is this look for?"
        placeholderTextColor={placeholderColor}
        accessibilityLabel="Caption"
        className="min-h-tile w-full rounded-control border border-border bg-surface px-lg py-md font-body text-base text-ink dark:border-border/12"
      />

      <Text
        // Live, but not assertive: a counter that interrupts a screen reader on
        // every keystroke is unusable.
        accessibilityLiveRegion={nearLimit ? "polite" : "none"}
        className={cn(
          "self-end font-body text-micro",
          nearLimit ? "text-ink" : "text-muted",
        )}
      >
        {value.length} / {MAX_CAPTION_LENGTH}
      </Text>
    </View>
  );
}

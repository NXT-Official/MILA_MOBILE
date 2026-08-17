import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";

/**
 * Openers that prefill the composer.
 *
 * **They fill the box; they never send.** A tap that quietly spent a credit on
 * a question the member had not finished deciding to ask would be the single
 * worst interaction in the product — so this writes the text and leaves the
 * send to her.
 *
 * The two sets are the web's verbatim. Anchored prompts are about *this*
 * outfit; the general ones open a conversation from nothing.
 */
const GENERAL_PROMPTS = [
  "Build an outfit for today",
  "Which neutrals suit my palette?",
  "Help me plan a capsule wardrobe",
  "What should I wear to a dinner?",
  "Suggest an easy beauty look",
];

const ANCHORED_PROMPTS = [
  "What would you change?",
  "Suggest shoes and accessories",
  "Make this more polished",
  "Adapt this for evening",
  "Does this suit my palette?",
];

export function SuggestedActions({
  anchored,
  onSelect,
}: {
  anchored: boolean;
  onSelect: (prompt: string) => void;
}) {
  const prompts = anchored ? ANCHORED_PROMPTS : GENERAL_PROMPTS;

  return (
    // Wrapping, as the web stacks them — not the horizontal carousel this was.
    // They are only rendered against an empty composer, so the tallest this
    // gets is the opening screen, where the thread above it is empty anyway.
    <View className="flex-row flex-wrap items-center gap-sm px-xl">
      {prompts.map((prompt) => (
        <Pressable
          key={prompt}
          accessibilityRole="button"
          accessibilityHint="Puts this in the message box. It is not sent until you send it."
          accessibilityLabel={prompt}
          onPress={() => onSelect(prompt)}
          className="active:opacity-80 min-h-tap flex-row items-center gap-sm rounded-pill border border-border bg-surface px-lg dark:border-border/12"
        >
          {/* Gold, and the only gold on this screen — it marks "this fills the
              box" and carries no state, so §10's hue rule is not in play. */}
          <Icon name="prompt" size="xs" color="accent" />
          <Text className="font-body text-sm text-body">{prompt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

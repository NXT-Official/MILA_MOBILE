import { Pressable, ScrollView, Text } from "react-native";

import { spacing } from "@/theme/tokens";

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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // A deliberate carousel, which §10 permits — the alternative is a wrapping
      // grid that pushes the composer off a small screen.
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}
    >
      {prompts.map((prompt) => (
        <Pressable
          key={prompt}
          accessibilityRole="button"
          accessibilityHint="Puts this in the message box. It is not sent until you send it."
          accessibilityLabel={prompt}
          onPress={() => onSelect(prompt)}
          style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
          className="min-h-tap flex-row items-center rounded-pill border border-border bg-surface px-lg dark:border-border/12"
        >
          <Text className="font-body text-sm text-body">{prompt}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

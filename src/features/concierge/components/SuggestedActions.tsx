import { Pressable, ScrollView, Text } from "react-native";

import { Icon } from "@/components/ui/Icon";
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

/** The web's third set, for when a photo is attached — same priority order. */
const ATTACHMENT_PROMPTS = [
  "What do you think of this?",
  "How would you style this?",
  "Does this suit my palette?",
  "What occasions fit this piece?",
  "What would you pair with it?",
];

export function SuggestedActions({
  anchored,
  attached = false,
  onSelect,
}: {
  anchored: boolean;
  /** A photo is staged in the composer — its own openers, as on the web. */
  attached?: boolean;
  onSelect: (prompt: string) => void;
}) {
  // The web's order: an attachment outranks an anchor, an anchor outranks the
  // general set.
  const prompts = attached ? ATTACHMENT_PROMPTS : anchored ? ANCHORED_PROMPTS : GENERAL_PROMPTS;

  return (
    // One line that scrolls. The web wraps these into a five-row stack, which
    // on a phone is a third of the screen standing between the thread and the
    // composer — a deliberate carousel is the §10-permitted answer.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Third-party prop that takes a style object — case 1 of the exceptions.
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}
    >
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
          <Text numberOfLines={1} className="font-body text-sm text-body">
            {prompt}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

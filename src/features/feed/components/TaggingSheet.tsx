import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { normalizeSourceUrl, type PostItem } from "@/lib/outfit-items";
import { resolveApiFailure } from "@/services/api/client";
import { updatePostItems } from "@/services/supabase/post-items";
import { useAuthStore } from "@/stores/auth-store";
import { useThemeColor } from "@/theme/tailwind";

type Draft = { id: string; category: string; label: string; sourceUrl: string };

/**
 * Rename a detected garment, link where it is from, or drop it.
 *
 * Opens **automatically** after a publish that detected something, and not at
 * all when nothing was found — a sheet that says "Mila spotted 0 pieces" is an
 * apology for a thing the member never asked for. A zero-detection result also
 * charges nothing; the server refunds it.
 *
 * The copy is deliberate about stakes: her look is already posted. This is
 * optional polish, and "Skip" is a first-class exit.
 */
export function TaggingSheet({
  postId,
  items,
  visible,
  onClose,
}: {
  postId: string;
  items: PostItem[];
  visible: boolean;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(items));
  const [seeded, setSeeded] = useState(postId);
  const placeholderColor = useThemeColor("muted");
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  // A second publish in the same session reuses this component. Re-seeding on
  // the id rather than in an effect keeps the drafts correct on the first render
  // instead of one frame later.
  if (seeded !== postId) {
    setSeeded(postId);
    setDrafts(toDrafts(items));
  }

  const save = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error("Not signed in.");
      return updatePostItems(userId, {
        post_id: postId,
        // A replace, not a patch: anything missing from this array is deleted
        // server-side, which is exactly what removing a row here should mean.
        items: drafts.map((d) => ({
          id: d.id,
          label: d.label.trim(),
          source_url: d.sourceUrl.trim() || null,
        })),
      });
    },
    onSuccess: onClose,
  });

  function edit(id: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  // Checked here as well as server-side. The server *refuses* a non-https link
  // rather than dropping it, so catching it inline is the difference between
  // naming the typo and reporting a failed save.
  const invalidLink = drafts.find((d) => d.sourceUrl.trim() && !normalizeSourceUrl(d.sourceUrl));
  const emptyLabel = drafts.some((d) => !d.label.trim());

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        if (!save.isPending) onClose();
      }}
      title={`Mila spotted ${drafts.length} ${drafts.length === 1 ? "piece" : "pieces"}`}
    >
      <View className="gap-lg">
        <Text className="font-body text-base text-body">
          Fix a name, add the link where it is from, or skip entirely — your look is already posted.
        </Text>

        {drafts.map((draft) => (
          <View
            key={draft.id}
            className="gap-md rounded-panel border border-border bg-surface p-lg dark:border-border/12"
          >
            <View className="flex-row items-center gap-md">
              <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
                {draft.category}
              </Text>
              <View className="flex-1" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${draft.label || "this piece"}`}
                onPress={() => setDrafts((c) => c.filter((d) => d.id !== draft.id))}
                className="active:opacity-60 h-tap w-tap items-center justify-center"
              >
                <Icon name="trash" size="sm" color="muted" />
              </Pressable>
            </View>

            <TextInput
              value={draft.label}
              onChangeText={(label) => edit(draft.id, { label })}
              maxLength={100}
              accessibilityLabel="Piece name"
              placeholder="What is this piece?"
              placeholderTextColor={placeholderColor}
              className="h-12 w-full rounded-control border border-border bg-canvas px-lg font-body text-base text-ink dark:border-border/12"
            />

            <TextInput
              value={draft.sourceUrl}
              onChangeText={(sourceUrl) => edit(draft.id, { sourceUrl })}
              maxLength={2048}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Where this piece is from"
              placeholder="https://where-its-from.com"
              placeholderTextColor={placeholderColor}
              className="h-12 w-full rounded-control border border-border bg-canvas px-lg font-body text-base text-ink dark:border-border/12"
            />
          </View>
        ))}

        {drafts.length === 0 ? (
          <Text className="font-body text-sm text-body">
            No pieces left to tag. Saving removes every tag from this look.
          </Text>
        ) : null}

        {invalidLink ? (
          <InlineError
            message={`Links must start with https:// — check "${invalidLink.label || "that piece"}".`}
          />
        ) : null}

        {save.isError ? <InlineError message={resolveApiFailure(save.error).message} /> : null}

        <Button
          label="Save tags"
          loading={save.isPending}
          disabled={Boolean(invalidLink) || emptyLabel}
          onPress={() => save.mutate()}
        />
        <Button label="Skip" variant="ghost" disabled={save.isPending} onPress={onClose} />
      </View>
    </Sheet>
  );
}

function toDrafts(items: PostItem[]): Draft[] {
  return items.map((item) => ({
    id: item.id,
    category: item.category,
    label: item.label,
    sourceUrl: item.source_url ?? "",
  }));
}

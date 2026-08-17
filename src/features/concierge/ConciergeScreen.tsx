import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AccessibilityInfo, KeyboardAvoidingView, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeepAwake } from "@/components/feedback/KeepAwake";
import { PaywallSheet } from "@/components/feedback/PaywallSheet";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { queryKeys } from "@/constants/query-keys";
import { useCountdown } from "@/hooks/use-countdown";
import { useHaptics } from "@/hooks/use-haptics";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useProfile } from "@/hooks/use-profile";
import { formatRetryAfter, resolveApiFailure } from "@/services/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { useConciergeStore } from "@/stores/concierge-store";

import { AnchoredLookCard } from "./components/AnchoredLookCard";
import { Composer } from "./components/Composer";
import { ConversationSheet } from "./components/ConversationSheet";
import { SuggestedActions } from "./components/SuggestedActions";
import { Thread, type ThreadMessage } from "./components/Thread";
import { useConversationMessages } from "./hooks/use-conversations";
import { useSendMessage } from "./hooks/use-send-message";

/**
 * The stylist conversation.
 *
 * **Local state is the truth for the open thread; the query is how a thread is
 * loaded.** A new conversation has no row to query until its first turn lands,
 * and a failed send has to stay on screen without ever reaching the database —
 * neither fits a cache-as-truth model, and forcing them into one is how a
 * member loses a message she typed.
 *
 * No prompt, no system message, and no model configuration exists here or
 * anywhere in this repo (§8).
 */
export function ConciergeScreen() {
  const insets = useSafeAreaInsets();

  const [conversationId, setConversationId] = useState<string | null>(null);
  /** Which conversation the local thread was seeded from. */
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  /** Epoch ms the server's rate limit lifts, or null. */
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const { online } = useNetworkStatus();
  const haptics = useHaptics();
  const send = useSendMessage();

  const anchoredLook = useConciergeStore((s) => s.anchoredLook);
  const clearAnchor = useConciergeStore((s) => s.clear);

  const { data: profile } = useProfile();
  /** Silhouette and season, as the web's header badges. */
  const dossierBadges = [profile?.body_type, profile?.color_season].filter(
    (value): value is string => Boolean(value),
  );

  const rateLimitedFor = useCountdown(rateLimitedUntil);
  const { data: loaded } = useConversationMessages(conversationId);

  /**
   * Seed the thread when a conversation is opened from the list.
   *
   * Adjusted during render rather than in an effect: React re-runs immediately
   * with the corrected state and commits nothing in between, so the previous
   * conversation never paints for a frame under the new title.
   */
  if (conversationId && conversationId !== seededFrom && loaded) {
    setSeededFrom(conversationId);
    setMessages(
      loaded.map((row) => ({ id: row.id, role: row.role, content: row.content })),
    );
  }

  const blockedMessage = !online
    ? "Mila needs a connection to answer."
    : rateLimitedFor > 0
      ? formatRetryAfter(rateLimitedFor)
      : null;

  /**
   * Every failure lands here. `kind` decides the response, so a code that is not
   * yet handled cannot become a blank screen — and `INSUFFICIENT_CREDITS`
   * cannot fall into the generic handler, which is the one thing §7 forbids.
   */
  function handleFailure(error: unknown) {
    const failure = resolveApiFailure(error);

    if (failure.kind === "paywall") {
      setPaywallOpen(true);
      return;
    }
    if (failure.kind === "rate-limited") {
      setRateLimitedUntil(Date.now() + (failure.retryAfterSeconds ?? 60) * 1000);
      return;
    }
    if (failure.kind === "suspended" || failure.kind === "auth") {
      // The root gate owns the redirect; re-reading the profile makes it decide.
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    }
  }

  function handleSend() {
    const message = draft.trim();
    if (!message || send.isPending || blockedMessage) return;

    const pendingId = `pending-${Date.now()}`;
    const thread = messages.map((m) => ({
      role: m.role,
      content: m.content,
      failed: m.failed,
    }));

    // Optimistic, and the draft is cleared only here — a failure below puts it
    // back rather than losing what she typed.
    setMessages((current) => [...current, { id: pendingId, role: "user", content: message }]);
    setDraft("");

    send.mutate(
      { message, thread, conversationId, lookId: anchoredLook?.id ?? null },
      {
        onSuccess: (result) => {
          haptics.success();
          setConversationId(result.conversationId);
          // Claim the seed slot: the local thread is already correct, and
          // letting the query re-seed would drop any failed message above.
          setSeededFrom(result.conversationId);
          setMessages((current) => [
            ...current,
            { id: `${pendingId}-reply`, role: "assistant", content: result.reply },
          ]);
          AccessibilityInfo.announceForAccessibility("Mila replied.");
        },
        onError: (error) => {
          // The message stays on screen, marked, and the text returns to the
          // composer. Nothing she wrote is discarded (§7 of the checklist).
          setMessages((current) =>
            current.map((m) => (m.id === pendingId ? { ...m, failed: true } : m)),
          );
          setDraft(message);
          handleFailure(error);
        },
      },
    );
  }

  function startNewConversation() {
    setConversationId(null);
    setSeededFrom(null);
    setMessages([]);
    send.reset();
  }

  /**
   * Clear before loading, not after.
   *
   * The new conversation's query starts empty while it fetches, so leaving the
   * old messages up would show her thread A for as long as thread B takes to
   * arrive — under the title she just tapped.
   */
  function openConversation(id: string) {
    setConversationId(id);
    setSeededFrom(null);
    setMessages([]);
    send.reset();
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      {send.isPending ? <KeepAwake /> : null}

      {/* The web's studio header: the panel glyph, the kicker and title, then
          the dossier badges. The panel presents the conversation list as a
          bottom sheet — a side drawer would fight the Android back gesture. */}
      <View className="gap-md border-b border-border px-lg py-md dark:border-border/12">
        <View className="flex-row items-center gap-sm">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your conversations"
            onPress={() => setListOpen(true)}
            className="active:opacity-60 -ml-md h-tap w-tap items-center justify-center"
          >
            <Icon name="panel" size="md" color="body" />
          </Pressable>

          <View className="flex-1 gap-xs">
            <Text className="font-body-medium text-label tracking-label uppercase text-muted">
              Mila&apos;s Insights
            </Text>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              className="font-display text-h2 tracking-heading text-ink"
            >
              Mila&apos;s Styling Studio
            </Text>
          </View>
        </View>

        {dossierBadges.length > 0 ? (
          <View className="flex-row flex-wrap items-center gap-sm">
            {dossierBadges.map((badge) => (
              <Badge key={badge} label={badge} />
            ))}
          </View>
        ) : null}
      </View>

      {/* `padding` on both platforms: under the edge-to-edge that SDK 54+ always
          enables, the window no longer resizes for the IME, so the same
          behaviour is correct on each — and a `Platform.OS` branch is forbidden
          in a screen (§12). */}
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <Thread
          messages={messages}
          awaitingReply={send.isPending}
          header={
            anchoredLook ? (
              <AnchoredLookCard look={anchoredLook} onClear={clearAnchor} />
            ) : null
          }
          anchored={Boolean(anchoredLook)}
        />

        {/* The composer sits above the gesture bar or the button navigation bar,
            whichever the device has — never a hardcoded inset (§9). */}
        <View className="gap-md" style={{ paddingBottom: insets.bottom }}>
          {/* Prefill only: a tap here never sends and never spends a credit.
              Shown only against an empty box, so a chip can never overwrite a
              question she has already started writing. */}
          {draft.trim().length === 0 ? (
            <SuggestedActions anchored={Boolean(anchoredLook)} onSelect={setDraft} />
          ) : null}

          <Composer
            value={draft}
            onChangeText={setDraft}
            onSend={handleSend}
            sending={send.isPending}
            blockedMessage={blockedMessage}
          />
        </View>
      </KeyboardAvoidingView>

      <ConversationSheet
        visible={listOpen}
        currentId={conversationId}
        onClose={() => setListOpen(false)}
        onSelect={openConversation}
        onNewConversation={startNewConversation}
      />

      <PaywallSheet
        visible={paywallOpen}
        onClose={() => {
          setPaywallOpen(false);
          // Clear the failed mutation with the sheet, or the composer stays in
          // its error state behind a paywall she has already dismissed. The
          // typed message is already back in the box.
          if (send.isError) send.reset();
        }}
      />
    </View>
  );
}

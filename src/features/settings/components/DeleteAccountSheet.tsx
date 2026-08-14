import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { resolveApiFailure } from "@/services/api/client";

import { useDeleteAccount } from "../hooks/use-account-actions";

/**
 * The one action with no undo.
 *
 * Typing the email is the confirmation, not a checkbox: it is the standard
 * friction for an irreversible destructive action, and it cannot be tapped
 * through by accident. The server re-checks the address against the session, so
 * the comparison here is UX — the one that counts is server-side.
 *
 * A sheet, never `Alert.alert` (§4).
 */
export function DeleteAccountSheet({
  visible,
  email,
  onClose,
}: {
  visible: boolean;
  /** The account's own address — what she has to type back. */
  email: string;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const remove = useDeleteAccount();

  // Case-insensitive: the address is not a password, and rejecting "Ana@" for a
  // stored "ana@" would be friction with no safety in it.
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        if (remove.isPending) return;
        setTyped("");
        remove.reset();
        onClose();
      }}
      title="Delete your account"
    >
      <View className="gap-lg">
        <Text className="font-body text-base text-body">
          This cannot be undone. Your dossier, saved looks, posts, palettes, and conversations are
          deleted, your photographs are purged from storage, and any membership is cancelled
          immediately.
        </Text>

        <Input
          label={`Type ${email} to confirm`}
          value={typed}
          onChangeText={setTyped}
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Type your email address to confirm deletion"
        />

        {remove.isError ? (
          <InlineError message={resolveApiFailure(remove.error).message} />
        ) : null}

        <Button
          label="Delete my account"
          variant="destructive"
          disabled={!matches}
          loading={remove.isPending}
          onPress={() => remove.mutate(email)}
        />
        <Button
          label="Keep my account"
          variant="secondary"
          disabled={remove.isPending}
          onPress={() => {
            setTyped("");
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

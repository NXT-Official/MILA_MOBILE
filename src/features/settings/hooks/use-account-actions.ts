import { useMutation } from "@tanstack/react-query";

import { deleteAccount } from "@/services/api/account";
import { assembleExport, exportFilename } from "@/services/export";
import { files } from "@/services/files";
import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Changing an email does not change it. Supabase sends a confirmation to the
 * **new** address and the change lands only when that link is opened — so the
 * copy has to promise an email, not a change, or a member will think it failed.
 */
export function useChangeEmail() {
  return useMutation<void, unknown, string>({
    mutationFn: async (email) => {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    },
  });
}

/**
 * Change password, as the same two-step re-auth the web uses (§5).
 *
 * The re-auth is the point: a session can be a phone left unlocked on a table,
 * and `updateUser({ password })` alone would let anyone holding it lock the
 * owner out. `signInWithPassword` proves the current password before the new
 * one is accepted, and a wrong one fails here rather than silently succeeding.
 */
export function useChangePassword() {
  return useMutation<void, unknown, { currentPassword: string; newPassword: string }>({
    mutationFn: async ({ currentPassword, newPassword }) => {
      const email = useAuthStore.getState().session?.user.email;
      if (!email) throw new Error("You need to be signed in to change your password.");

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) throw new Error("That current password isn't right.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
  });
}

/**
 * Assemble, write, share — the platform half is entirely inside
 * `services/files/` (§12), which is why the privacy screen has no platform code
 * in it and why iOS will need no change here.
 */
export function useExportData() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation<"shared" | "cancelled", unknown, void>({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in.");
      const data = await assembleExport(userId);

      return files.saveAndShare({
        filename: exportFilename(),
        mimeType: "application/json",
        // Indented: this is a file a person opens and reads, not a payload.
        contents: JSON.stringify(data, null, 2),
      });
    },
  });
}

/**
 * Irreversible, and the one action in the app with no undo.
 *
 * The session is dropped locally — the server has already deleted the auth
 * user, so the refresh token in SecureStore is dead weight that would otherwise
 * fail confusingly on the next launch. Dropping it emits `SIGNED_OUT`, which
 * clears the cache and closes the session gate back to `/login`; doing either
 * by hand here would be a second owner of the same transition.
 */
export function useDeleteAccount() {
  return useMutation<void, unknown, string>({
    mutationFn: async (email) => {
      await deleteAccount(email);
    },
    onSuccess: async () => {
      await supabase.auth.signOut().catch(() => {
        // The auth user is already gone, so this can legitimately fail.
      });
    },
  });
}

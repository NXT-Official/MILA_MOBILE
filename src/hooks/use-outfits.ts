import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteOutfit, fetchOutfit, fetchOutfits } from "@/services/supabase/outfits";
import { useAuthStore } from "@/stores/auth-store";

/**
 * `constants/query-keys.ts` is a verbatim copy of the web's (Appendix A) and has
 * no history key — the web's History route builds its own inline. Declared here
 * rather than added to the copied file, so a re-copy from web still lands clean.
 */
export const outfitsKey = (userId: string | undefined) => ["outfits", userId] as const;
export const outfitKey = (userId: string | undefined, id: string) =>
  ["outfits", userId, id] as const;

export function useOutfits() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: outfitsKey(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: () => fetchOutfits(userId as string),
  });
}

export function useOutfit(id: string) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: outfitKey(userId ?? undefined, id),
    enabled: Boolean(userId) && Boolean(id),
    staleTime: 60_000,
    queryFn: () => fetchOutfit(userId as string, id),
  });
}

export function useDeleteOutfit() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<void, unknown, string>({
    mutationFn: (id) => {
      if (!userId) throw new Error("Not signed in.");
      return deleteOutfit(userId, id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: outfitsKey(userId ?? undefined) });
    },
  });
}

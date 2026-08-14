import { useMutation, useQueryClient } from "@tanstack/react-query";

import { outfitsKey } from "@/hooks/use-outfits";
import { saveOutfitToHistory, type SaveLookInput, type SavedLook } from "@/services/api/look";
import { useAuthStore } from "@/stores/auth-store";

/**
 * `POST /look/save` — free. The server uploads the `data:` URI to the `outfits`
 * bucket under `${userId}/` and inserts the row; the client uploads nothing.
 *
 * No credits invalidation here, because nothing is charged. Only the history
 * list is invalidated, and explicitly by key.
 */
export function useSaveLook() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<SavedLook, unknown, SaveLookInput>({
    mutationFn: saveOutfitToHistory,
    onSuccess: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: outfitsKey(userId) });
    },
  });
}

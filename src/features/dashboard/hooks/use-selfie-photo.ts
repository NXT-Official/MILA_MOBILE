import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import {
  deleteMyProfilePhoto,
  fetchProfilePhotoUrl,
  saveConsentedProfilePhoto,
} from "@/services/supabase/profile";
import { useAuthStore } from "@/stores/auth-store";

/** A signed thumbnail for the consented selfie, fetched only once it exists. */
export function useProfilePhotoUrl(enabled: boolean) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: queryKeys.profilePhotoUrl(userId ?? undefined),
    queryFn: () => fetchProfilePhotoUrl(userId as string),
    enabled: Boolean(userId) && enabled,
    staleTime: 60_000,
  });
}

function invalidateSelfieQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | null,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId ?? undefined) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.profilePhotoUrl(userId ?? undefined) });
}

export function useSaveSelfiePhoto() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (uri: string) => {
      if (!userId) throw new Error("Not signed in.");
      await saveConsentedProfilePhoto(userId, uri);
    },
    onSuccess: () => invalidateSelfieQueries(queryClient, userId),
  });
}

export function useDeleteSelfiePhoto() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in.");
      await deleteMyProfilePhoto(userId);
    },
    onSuccess: () => invalidateSelfieQueries(queryClient, userId),
  });
}

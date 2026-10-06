import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import { trackEvent } from "@/services/supabase/analytics";
import {
  listSavedProducts,
  removeSavedProduct,
  saveProduct,
  type SavedProduct,
  type SavedProductsList,
  type SaveProductInput,
  type SaveSource,
} from "@/services/supabase/saved-products";
import { useAuthStore } from "@/stores/auth-store";

/**
 * The fields of a recommended product a card already holds: a Shop This Look
 * pick or a catalogue match. Enough to name it, and to draw it in the saved
 * list for the moment before the server's own snapshot arrives.
 */
export type SaveableProduct = {
  id: string;
  title: string;
  image_url: string | null;
  affiliate_link: string;
  price: number;
  currency: string;
  category: string;
};

/**
 * Her saved pieces, or `unavailable` while the table does not exist yet. 60s
 * stale (§6), refetched after every save or removal rather than on a timer.
 * Every Save button reads this same key, so TanStack shares one request.
 */
export function useSavedProducts() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: queryKeys.savedProducts(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: () => listSavedProducts(userId as string),
  });
}

type SetSavedVariables = {
  product: SaveableProduct;
  source: SaveSource;
  outfitId?: string;
  postItemId?: string;
  /** The state she asked for: true saves, false removes. */
  saved: boolean;
};

/**
 * The id an optimistic row carries until the refetch brings the real one. It is
 * not a uuid, so nothing may send it to the server as a row id.
 */
const PENDING_ID_PREFIX = "pending-";

/** Every bookmark write shares this key, so a card can read its latest outcome. */
const SAVE_TOGGLE_KEY = ["saved-products", "toggle"] as const;

/** What the list looks like the instant she taps, before the server answers. */
function optimisticRow({ product, source, outfitId, postItemId }: SetSavedVariables): SavedProduct {
  return {
    id: `${PENDING_ID_PREFIX}${product.id}`,
    product_id: product.id,
    source,
    outfit_id: outfitId ?? null,
    post_item_id: postItemId ?? null,
    created_at: new Date().toISOString(),
    snapshot: {
      title: product.title,
      image_url: product.image_url,
      product_url: product.affiliate_link,
      price: product.price,
      currency: product.currency,
      category: product.category,
      brand: null,
    },
    availability: "available",
  };
}

/**
 * The bookmark's write. Optimistic: the cached list changes on the tap, and
 * the snapshot taken first is put back if the write fails, so the control
 * never claims a save that did not happen. The list is refetched either way,
 * by its explicit key (§6), and a mutation never auto-retries.
 */
export function useSetProductSaved() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const key = queryKeys.savedProducts(userId ?? undefined);

  return useMutation<
    "saved" | "already_saved" | "removed" | "not_found" | "unavailable",
    unknown,
    SetSavedVariables,
    { previous: SavedProductsList | undefined }
  >({
    mutationKey: SAVE_TOGGLE_KEY,
    mutationFn: (variables) => {
      if (!userId) throw new Error("Not signed in.");
      if (!variables.saved) {
        return removeSavedProduct(userId, { productId: variables.product.id });
      }
      const input: SaveProductInput = { productId: variables.product.id, source: variables.source };
      if (variables.outfitId) input.outfitId = variables.outfitId;
      if (variables.postItemId) input.postItemId = variables.postItemId;
      return saveProduct(userId, input);
    },
    // src: @tanstack/query-core 5.101.4 · build/modern/_tsup-dts-rollup.d.ts, MutationOptions:
    //   onMutate(variables, context) → onMutateResult; onError(error, variables, onMutateResult, context)
    onMutate: async (variables) => {
      // A refetch landing mid-write would overwrite the optimistic row.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedProductsList>(key);

      if (previous?.status === "ok") {
        const others = previous.items.filter((item) => item.product_id !== variables.product.id);
        const next: SavedProductsList = {
          status: "ok",
          items: variables.saved ? [optimisticRow(variables), ...others] : others,
        };
        queryClient.setQueryData(key, next);
      }
      return { previous };
    },
    onError: (_error, _variables, onMutateResult) => {
      if (onMutateResult?.previous) queryClient.setQueryData(key, onMutateResult.previous);
    },
    onSuccess: (outcome, variables) => {
      if (!userId) return;
      const properties = { product_id: variables.product.id, source: variables.source };
      // Only a write that changed a row is an event: "already_saved" is not a
      // new save, "not_found" removed nothing, and "unavailable" wrote nothing.
      if (outcome === "saved") void trackEvent(userId, "product_saved", properties);
      if (outcome === "removed") void trackEvent(userId, "product_unsaved", properties);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Removal from the saved screen, by row, behind a confirmation. Not
 * optimistic: the confirm sheet shows the wait and stays open on a failure, so
 * there is nothing to roll back.
 */
export function useRemoveSavedProduct() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<"removed" | "not_found" | "unavailable", unknown, SavedProduct>({
    mutationFn: (item) => {
      if (!userId) throw new Error("Not signed in.");
      // A row still showing its optimistic placeholder id is reached by its
      // product instead: one row per product, by the unique index.
      if (item.id.startsWith(PENDING_ID_PREFIX) && item.product_id) {
        return removeSavedProduct(userId, { productId: item.product_id });
      }
      return removeSavedProduct(userId, { id: item.id });
    },
    onSuccess: (outcome, item) => {
      if (userId && outcome === "removed") {
        void trackEvent(userId, "product_unsaved", {
          product_id: item.product_id,
          source: "saved_screen",
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.savedProducts(userId ?? undefined),
      });
    },
  });
}

/**
 * Whether the latest bookmark write for this product failed, and which way:
 * "save" or "remove". Read from TanStack's own mutation cache, so a card can
 * say so in words without the button handing state up to it. A new tap starts
 * a new write and the answer clears.
 *
 * // src: @tanstack/react-query 5.101.4 · build/modern/_tsup-dts-rollup.d.ts:
 * //   useMutationState({ filters: MutationFilters, select }) returns one entry
 * //   per matching mutation, oldest first.
 */
export function useSaveFailure(productId: string): "save" | "remove" | null {
  const outcomes = useMutationState({
    filters: {
      mutationKey: [...SAVE_TOGGLE_KEY],
      predicate: (mutation) =>
        (mutation.state.variables as SetSavedVariables | undefined)?.product.id === productId,
    },
    select: (mutation) => ({
      failed: mutation.state.status === "error",
      saving: (mutation.state.variables as SetSavedVariables | undefined)?.saved ?? true,
    }),
  });
  const latest = outcomes.at(-1);
  if (!latest?.failed) return null;
  return latest.saving ? "save" : "remove";
}

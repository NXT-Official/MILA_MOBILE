import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAppState } from "@/hooks/use-app-state";
import {
  fetchGenerationImage,
  fetchLatestGenerationJob,
  type GenerationJob,
} from "@/services/supabase/generation-jobs";
import { useAuthStore } from "@/stores/auth-store";

import { isLiveRunning } from "../generation-recovery";

/**
 * `constants/query-keys.ts` is a verbatim copy of the web's, so the keys this
 * feature owns are declared here (the same choice as `outfitsKey`).
 */
export const generationJobsKey = (userId: string | undefined) => ["generation-jobs", userId] as const;
const generationImageKey = (jobId: string | null, imagePath: string | null) =>
  ["generation-image", jobId, imagePath] as const;

/** How often the rows are read again while a job is running. */
const POLL_MS = 3_000;

type LatestJobs =
  | { status: "unavailable" }
  | {
      status: "ok";
      look: GenerationJob | null;
      styleSheet: GenerationJob | null;
      photoPreview: GenerationJob | null;
    };

export type GenerationJobsState = {
  /** False until the rows have been read, and while the migration is missing. */
  available: boolean;
  look: GenerationJob | null;
  styleSheet: GenerationJob | null;
  photoPreview: GenerationJob | null;
  /**
   * When the rows were last read, or last tried: the clock a running job's
   * deadline is judged by. A failed read still moves it, so a row last seen
   * running cannot keep the screen "composing" (or the poll going) forever
   * while she is offline.
   */
  readAt: number;
};

async function fetchLatestJobs(userId: string): Promise<LatestJobs> {
  const [look, styleSheet, photoPreview] = await Promise.all([
    fetchLatestGenerationJob(userId, "look"),
    fetchLatestGenerationJob(userId, "style_sheet"),
    fetchLatestGenerationJob(userId, "photo_preview"),
  ]);
  if (look.status !== "ok" || styleSheet.status !== "ok" || photoPreview.status !== "ok") {
    return { status: "unavailable" };
  }
  return { status: "ok", look: look.job, styleSheet: styleSheet.job, photoPreview: photoPreview.job };
}

/**
 * Her latest look, style sheet and portrait preview jobs (R7), server state in
 * TanStack Query (§6). Read on every mount, again when the app comes back from
 * the background, and every 3 s while one of them is still running, so a
 * generation that finished while she was away is on screen when she returns.
 *
 * A failed read keeps the last good rows (TanStack keeps `data` on error): a
 * blip in the connection never turns a running look into an empty screen.
 */
export function useGenerationJobs(): GenerationJobsState {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const key = generationJobsKey(userId ?? undefined);

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(userId),
    staleTime: 0,
    queryFn: () => fetchLatestJobs(userId as string),
    // src: https://tanstack.com/query/v5/docs/framework/react/reference/useQuery
    //   refetchInterval: number | false | ((query) => number | false | undefined) · @tanstack/react-query 5.101.4
    refetchInterval: (current) => {
      const data = current.state.data;
      if (!data || data.status !== "ok") return false;
      const readAt = Math.max(current.state.dataUpdatedAt, current.state.errorUpdatedAt);
      const running = [data.look, data.styleSheet, data.photoPreview].some(
        (job) => job !== null && isLiveRunning(job, readAt),
      );
      return running ? POLL_MS : false;
    },
  });

  // Explicit key, never a bare invalidateQueries() (§6).
  useAppState(() => {
    if (userId) void queryClient.invalidateQueries({ queryKey: generationJobsKey(userId) });
  });

  const data = query.data;
  if (!data || data.status !== "ok") {
    return { available: false, look: null, styleSheet: null, photoPreview: null, readAt: 0 };
  }
  return {
    available: true,
    look: data.look,
    styleSheet: data.styleSheet,
    photoPreview: data.photoPreview,
    readAt: Math.max(query.dataUpdatedAt, query.errorUpdatedAt),
  };
}

export type GenerationImage = {
  /** The image as a `data:` URI, once read. */
  image: string | null;
  /** Being read: the slot waits rather than calling the render failed. */
  loading: boolean;
  /** Could not be read (after the client's own retries). */
  failed: boolean;
  /** Reads the stored image again. Never a new render, so never a charge. */
  retry: () => void;
};

/**
 * A succeeded render's image, read once: a job's image path names one object
 * that never changes. Only ever asked for with a row that `recoverVisual`
 * handed over as succeeded.
 */
export function useGenerationImage(job: GenerationJob | null): GenerationImage {
  const readable = job !== null && job.status === "succeeded" && job.image_path !== null;
  const query = useQuery({
    queryKey: generationImageKey(job?.id ?? null, job?.image_path ?? null),
    enabled: readable,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    queryFn: () => fetchGenerationImage(job as GenerationJob),
  });
  const retry = () => void query.refetch();
  if (!readable) return { image: null, loading: false, failed: false, retry };
  return {
    image: query.data ?? null,
    loading: query.isPending && !query.isError,
    failed: query.isError && !query.data,
    retry,
  };
}

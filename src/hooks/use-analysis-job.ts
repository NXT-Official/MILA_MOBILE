import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import {
  fetchLatestAnalysisJob,
  type AnalysisJob,
  type AnalysisJobKind,
} from "@/services/supabase/analysis-jobs";
import { useAnalysisDismissedStore } from "@/stores/analysis-dismissed-store";
import { useAuthStore } from "@/stores/auth-store";

import { useAppState } from "./use-app-state";

/** How often the row is read again while the job is running. */
const POLL_MS = 3_000;
/** A running job is trusted this long past its deadline, then it is treated as stale. */
const RUNNING_GRACE_MS = 30_000;
/** A finished job is offered for this long, then it is no longer news. */
const OFFER_WINDOW_MS = 12 * 3_600_000;

export type AnalysisJobState = {
  /** False until the row has been read, and while the migration is missing. */
  available: boolean;
  /** Her newest job of this kind, or null. */
  job: AnalysisJob | null;
  /** The job is still within its deadline: the read is on its way. */
  running: boolean;
  /** A succeeded job she has not dismissed, finished within 12 h. Offered once. */
  ready: AnalysisJob | null;
  /** Hides a job from `ready` for good (the last 20 ids are remembered). */
  dismiss: (jobId: string) => void;
};

function isRunning(job: AnalysisJob, now: number): boolean {
  if (job.status !== "running") return false;
  const deadline = Date.parse(job.deadline_at);
  return Number.isNaN(deadline) ? false : now <= deadline + RUNNING_GRACE_MS;
}

/**
 * Her latest job of one kind, server state in TanStack Query (§6): read on
 * mount, again when the app returns from the background, and every 3 s while it
 * is running, so a read that finished while she was away is waiting for her.
 *
 * The offer rule here is the minimal one the hook needs now: a succeeded job
 * inside the 12 h window that she has not dismissed. The full offer, with the
 * per-kind "already applied" checks, is the shared `analysis-job-offer` module.
 */
export function useAnalysisJob(kind: AnalysisJobKind): AnalysisJobState {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const key = queryKeys.analysisJob(userId ?? undefined, kind);
  const dismissedIds = useAnalysisDismissedStore((s) => s.ids);
  const dismiss = useAnalysisDismissedStore((s) => s.dismiss);

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(userId),
    staleTime: 0,
    queryFn: () => fetchLatestAnalysisJob(userId as string, kind),
    // src: https://tanstack.com/query/v5/docs/framework/react/reference/useQuery
    //   refetchInterval: number | false | ((query) => number | false | undefined) · @tanstack/react-query 5.101.4
    refetchInterval: (current) => {
      const data = current.state.data;
      if (!data || data.status !== "ok" || !data.job) return false;
      // A failed read still moves the clock, so a row last seen running cannot
      // keep the poll going forever while she is offline.
      const readAt = Math.max(current.state.dataUpdatedAt, current.state.errorUpdatedAt);
      return isRunning(data.job, readAt) ? POLL_MS : false;
    },
  });

  // Explicit key, never a bare invalidateQueries() (§6).
  useAppState(() => {
    if (userId) void queryClient.invalidateQueries({ queryKey: key });
  });

  const data = query.data;
  if (!data || data.status !== "ok") {
    return { available: false, job: null, running: false, ready: null, dismiss };
  }

  const job = data.job;
  const readAt = Math.max(query.dataUpdatedAt, query.errorUpdatedAt);
  const completedAt = job?.completed_at ? Date.parse(job.completed_at) : Number.NaN;
  const ready =
    job !== null &&
    job.status === "succeeded" &&
    !Number.isNaN(completedAt) &&
    readAt - completedAt <= OFFER_WINDOW_MS &&
    !dismissedIds.includes(job.id)
      ? job
      : null;

  return {
    available: true,
    job,
    running: job !== null && isRunning(job, readAt),
    ready,
    dismiss,
  };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import {
  ANALYSIS_POLL_MS,
  analysisJobOffer,
  type AnalysisJobLike,
  type AnalysisJobOffer,
} from "@/lib/analysis-job-offer";
import {
  fetchLatestAnalysisJob,
  type AnalysisJob,
  type AnalysisJobKind,
} from "@/services/supabase/analysis-jobs";
import { useAnalysisDismissedStore } from "@/stores/analysis-dismissed-store";
import { useAuthStore } from "@/stores/auth-store";

import { useAppState } from "./use-app-state";

/** What the kind knows about her profile, so a read she already applied is not offered again. */
export type AnalysisJobContext = {
  /** color_read: the job her saved dossier already came from. */
  usedJobId?: string | null;
  /** check_in: `profiles.last_check_in_at`. */
  appliedAt?: string | null;
};

function toOfferJob(job: AnalysisJob): AnalysisJobLike {
  return {
    id: job.id,
    status: job.status,
    result: job.result,
    errorCode: job.error_code,
    deadlineAt: job.deadline_at,
    completedAt: job.completed_at,
  };
}

export type AnalysisJobState = {
  /** False until the row has been read, and while the migration is missing. */
  available: boolean;
  /** Her newest job of this kind, or null. */
  job: AnalysisJob | null;
  /** What the job means right now (shared `analysisJobOffer`), or null. */
  offer: AnalysisJobOffer | null;
  /** The job is still within its deadline: the read is on its way. */
  running: boolean;
  /** A succeeded, undismissed, unapplied job finished within 12 h. Offered once. */
  ready: AnalysisJob | null;
  /** Hides a job from `ready` for good (the last 20 ids are remembered). */
  dismiss: (jobId: string) => void;
};

/**
 * Her latest job of one kind, server state in TanStack Query (§6): read on
 * mount, again when the app returns from the background, and every 3 s while it
 * is running, so a read that finished while she was away is waiting for her.
 *
 * What a job means (running, stale, ready, failed) is the shared
 * `analysisJobOffer`, so web and mobile decide it one way.
 */
export function useAnalysisJob(
  kind: AnalysisJobKind,
  context: AnalysisJobContext = {},
): AnalysisJobState {
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
      return analysisJobOffer(toOfferJob(data.job), { now: readAt }) === "running"
        ? ANALYSIS_POLL_MS
        : false;
    },
  });

  // Explicit key, never a bare invalidateQueries() (§6).
  useAppState(() => {
    if (userId) void queryClient.invalidateQueries({ queryKey: key });
  });

  const data = query.data;
  if (!data || data.status !== "ok") {
    return { available: false, job: null, offer: null, running: false, ready: null, dismiss };
  }

  const job = data.job;
  const readAt = Math.max(query.dataUpdatedAt, query.errorUpdatedAt);
  const offer = job
    ? analysisJobOffer(toOfferJob(job), {
        now: readAt,
        dismissedIds,
        usedJobId: context.usedJobId,
        appliedAt: context.appliedAt,
      })
    : null;

  return {
    available: true,
    job,
    offer,
    running: offer === "running",
    ready: offer === "ready" ? job : null,
    dismiss,
  };
}

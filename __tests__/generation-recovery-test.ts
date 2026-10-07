import {
  belongsTo,
  isLiveRunning,
  jobOutcome,
  parseStoredLook,
  recoverLook,
  recoverVisual,
} from "@/features/dashboard/generation-recovery";
import type { GenerationJob } from "@/services/supabase/generation-jobs";
import type { DailyLook } from "@/types/look";

/**
 * What Home shows from a job row it did not watch finish: after a background,
 * a remount or a restart. The rules, in member terms:
 *
 * - A job still running is shown as still running, and blocks a second paid
 *   press, until it settles or is plainly dead (past its deadline and the
 *   reaper's grace).
 * - Her own press is matched by its key, so an older job never stands in for a
 *   request that failed before it reached the server.
 * - A row that was delivered but could not be stored is never a failure.
 * - A visual belongs to the look it was drawn after.
 */

const NOW = new Date(2026, 9, 7, 12, 0, 0).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

const LOOK: DailyLook = {
  outfit: { headline: "Linen and light", description: "A light layer.", styling_notes: "Roll the cuff." },
  hair: { style: "Loose waves", execution_tip: "Air dry." },
  makeup: null,
  vibe_alignment_score: 8,
};

function job(overrides: Partial<GenerationJob>): GenerationJob {
  return {
    id: "look-job",
    kind: "look",
    client_request_id: "request-look",
    status: "running",
    result: null,
    image_path: null,
    error_code: null,
    deadline_at: iso(NOW + 240_000),
    created_at: iso(NOW - 60_000),
    completed_at: null,
    ...overrides,
  };
}

const succeededLook = (overrides: Partial<GenerationJob> = {}) =>
  job({ status: "succeeded", result: LOOK, completed_at: iso(NOW - 10_000), ...overrides });

describe("jobOutcome", () => {
  it("is running while the job is inside its deadline", () => {
    expect(jobOutcome(job({}), NOW)).toBe("running");
    expect(isLiveRunning(job({}), NOW)).toBe(true);
  });

  it("waits out the reaper's 30 s grace and some clock skew before calling a running job dead", () => {
    const deadline = NOW - 40_000;
    expect(jobOutcome(job({ deadline_at: iso(deadline) }), NOW)).toBe("running");
    expect(jobOutcome(job({ deadline_at: iso(NOW - 46_000) }), NOW)).toBe("failed");
    expect(isLiveRunning(job({ deadline_at: iso(NOW - 46_000) }), NOW)).toBe(false);
  });

  it("reads a delivered-but-unsaved row as delivered, never as a failure", () => {
    expect(
      jobOutcome(job({ status: "failed", error_code: "persist_failed_delivered" }), NOW),
    ).toBe("delivered");
    expect(jobOutcome(job({ status: "failed", error_code: "render_failed" }), NOW)).toBe("failed");
    expect(jobOutcome(succeededLook(), NOW)).toBe("succeeded");
  });
});

describe("belongsTo", () => {
  it("matches her press by its key, or the job the server told her to follow", () => {
    expect(belongsTo(job({}), { clientRequestId: "request-look" })).toBe(true);
    expect(belongsTo(job({}), { clientRequestId: "other", followJobId: "look-job" })).toBe(true);
    expect(belongsTo(job({}), { clientRequestId: "other" })).toBe(false);
  });
});

describe("parseStoredLook", () => {
  it("accepts the stored look and refuses anything it could not render", () => {
    expect(parseStoredLook(LOOK)).toEqual(LOOK);
    expect(parseStoredLook(null)).toBeNull();
    expect(parseStoredLook({ outfit: { headline: "Only a headline" } })).toBeNull();
    expect(parseStoredLook([LOOK])).toBeNull();
  });
});

describe("recoverLook with nothing pressed on this screen", () => {
  const recover = (row: GenerationJob | null) => recoverLook({ job: row, action: null, nowMs: NOW });

  it("shows a running job as still composing", () => {
    expect(recover(job({}))).toMatchObject({ composing: true, look: null, ownRequest: false });
  });

  it("shows today's finished look", () => {
    const row = succeededLook();
    expect(recover(row)).toEqual({ composing: false, look: LOOK, job: row, ownRequest: false });
  });

  it("does not bring back a look from another day", () => {
    const yesterday = new Date(2026, 9, 6, 12, 0, 0).getTime();
    expect(recover(succeededLook({ created_at: iso(yesterday) }))).toMatchObject({
      composing: false,
      look: null,
      job: null,
    });
  });

  it("shows nothing for a failed, dead or delivered-but-unsaved job", () => {
    for (const row of [
      job({ status: "failed", error_code: "deadline_exceeded" }),
      job({ deadline_at: iso(NOW - 120_000) }),
      job({ status: "failed", error_code: "persist_failed_delivered" }),
      null,
    ]) {
      expect(recover(row)).toMatchObject({ composing: false, look: null });
    }
  });
});

describe("recoverLook for her own press", () => {
  it("follows her own job to its result, on any day", () => {
    const row = succeededLook({ created_at: iso(new Date(2026, 9, 6, 23, 59).getTime()) });
    expect(recoverLook({ job: row, action: { clientRequestId: "request-look" }, nowMs: NOW })).toEqual({
      composing: false,
      look: LOOK,
      job: row,
      ownRequest: true,
    });
  });

  it("follows the job the server named when it answered running", () => {
    expect(
      recoverLook({
        job: job({ client_request_id: "web-request" }),
        action: { clientRequestId: "request-look", followJobId: "look-job" },
        nowMs: NOW,
      }),
    ).toMatchObject({ composing: true, ownRequest: false });
  });

  it("never lets an older job stand in for a press that did not reach the server", () => {
    expect(
      recoverLook({ job: succeededLook(), action: { clientRequestId: "newer-press" }, nowMs: NOW }),
    ).toEqual({ composing: false, look: null, job: null, ownRequest: false });
  });

  it("keeps a delivered-but-unsaved job as hers, so its visuals still belong to it", () => {
    const row = job({ status: "failed", error_code: "persist_failed_delivered" });
    expect(
      recoverLook({ job: row, action: { clientRequestId: "request-look" }, nowMs: NOW }),
    ).toEqual({ composing: false, look: null, job: row, ownRequest: true });
  });
});

describe("recoverVisual", () => {
  const lookJob = succeededLook();
  const sheet = (overrides: Partial<GenerationJob>) =>
    job({
      id: "sheet-job",
      kind: "style_sheet",
      client_request_id: "request-sheet",
      created_at: iso(NOW - 30_000),
      ...overrides,
    });

  it("belongs to the look it was drawn after", () => {
    expect(recoverVisual({ job: sheet({}), action: null, lookJob, nowMs: NOW })).toEqual({
      rendering: true,
      succeededJob: null,
      failed: false,
    });
    expect(
      recoverVisual({
        job: sheet({ created_at: iso(NOW - 120_000) }),
        action: null,
        lookJob,
        nowMs: NOW,
      }),
    ).toEqual({ rendering: false, succeededJob: null, failed: false });
    expect(recoverVisual({ job: sheet({}), action: null, lookJob: null, nowMs: NOW })).toEqual({
      rendering: false,
      succeededJob: null,
      failed: false,
    });
  });

  it("hands over a succeeded render's row only when it has an image", () => {
    const done = sheet({ status: "succeeded", image_path: "member/sheet-job.jpg" });
    expect(recoverVisual({ job: done, action: null, lookJob, nowMs: NOW }).succeededJob).toBe(done);
    expect(
      recoverVisual({ job: sheet({ status: "succeeded" }), action: null, lookJob, nowMs: NOW })
        .succeededJob,
    ).toBeNull();
  });

  it("says a failed render failed, and a delivered one did not", () => {
    expect(
      recoverVisual({
        job: sheet({ status: "failed", error_code: "qa_failed" }),
        action: null,
        lookJob,
        nowMs: NOW,
      }),
    ).toEqual({ rendering: false, succeededJob: null, failed: true });
    expect(
      recoverVisual({
        job: sheet({ status: "failed", error_code: "persist_failed_delivered" }),
        action: { clientRequestId: "request-sheet" },
        lookJob,
        nowMs: NOW,
      }),
    ).toEqual({ rendering: false, succeededJob: null, failed: false });
  });

  it("follows only her own press when she made one", () => {
    expect(
      recoverVisual({ job: sheet({}), action: { clientRequestId: "another-press" }, lookJob, nowMs: NOW }),
    ).toEqual({ rendering: false, succeededJob: null, failed: false });
    expect(
      recoverVisual({
        job: sheet({}),
        action: { clientRequestId: "request-sheet" },
        lookJob: null,
        nowMs: NOW,
      }).rendering,
    ).toBe(true);
  });
});

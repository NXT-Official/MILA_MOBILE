import {
  belongsTo,
  failureNotice,
  isLiveRunning,
  isRecentLook,
  jobIsForLook,
  jobOutcome,
  lookAlreadySaved,
  lookKeyOf,
  lookInProgress,
  lookToRecover,
  parseStoredLook,
  recoveredLookLabel,
  recoverVisual,
  savedWeatherOf,
  sheetNeverDrawn,
  weatherBadgeOf,
} from "@/features/dashboard/generation-recovery";
import type { GenerationJob } from "@/services/supabase/generation-jobs";
import type { DailyLook } from "@/types/look";

/**
 * What Home shows from a generation job it did not watch finish: after a
 * background, a remount or a restart. The rules, in member terms (shared with
 * the web):
 *
 * - Her own unanswered press always lands, and a running job of hers shows as
 *   running until it settles or is plainly dead.
 * - Otherwise her latest finished look comes back only when nothing is on
 *   screen, she has not saved it, and it finished today or within the last
 *   12 hours. A look already on screen is never swapped.
 * - A row that was delivered but could not be stored is never a failure.
 * - A style sheet or portrait belongs to exactly one look: the one it was
 *   drawn for, matched by headline and description.
 */

const NOW = new Date(2026, 9, 7, 12, 0, 0).getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute, 0).getTime();

const LOOK: DailyLook = {
  outfit: { headline: "Linen and light", description: "A light layer.", styling_notes: "Roll the cuff." },
  hair: { style: "Loose waves", execution_tip: "Air dry." },
  makeup: null,
  vibe_alignment_score: 8,
};
const OTHER_LOOK: DailyLook = {
  ...LOOK,
  outfit: { ...LOOK.outfit, headline: "Rain-ready layers", description: "A shell over knit." },
};

function job(overrides: Partial<GenerationJob>): GenerationJob {
  return {
    id: "look-job",
    kind: "look",
    client_request_id: "request-look",
    status: "running",
    credit_state: "charged",
    result: null,
    image_path: null,
    error_code: null,
    deadline_at: iso(NOW + 240_000),
    created_at: iso(NOW - 60_000),
    completed_at: null,
    for_look: null,
    look_input: { vibe: "Brunch", weather: "24°C Sunny (in Manila)" },
    ...overrides,
  };
}

const succeededLook = (overrides: Partial<GenerationJob> = {}) =>
  job({ status: "succeeded", result: LOOK, completed_at: iso(NOW - 10_000), ...overrides });

const sheetFor = (look: DailyLook, overrides: Partial<GenerationJob> = {}) =>
  job({
    id: "sheet-job",
    kind: "style_sheet",
    client_request_id: "request-sheet",
    look_input: null,
    for_look: { headline: look.outfit.headline, description: look.outfit.description },
    ...overrides,
  });

describe("jobOutcome", () => {
  it("is running while the job is inside its deadline", () => {
    expect(jobOutcome(job({}), NOW)).toBe("running");
    expect(isLiveRunning(job({}), NOW)).toBe(true);
  });

  it("waits out the reaper's 30 s grace and some clock skew before calling a running job dead", () => {
    expect(jobOutcome(job({ deadline_at: iso(NOW - 40_000) }), NOW)).toBe("running");
    expect(jobOutcome(job({ deadline_at: iso(NOW - 46_000) }), NOW)).toBe("failed");
    expect(isLiveRunning(job({ deadline_at: iso(NOW - 46_000) }), NOW)).toBe(false);
  });

  it("reads a delivered-but-unsaved row as delivered, never as a failure", () => {
    expect(jobOutcome(job({ status: "failed", error_code: "persist_failed_delivered" }), NOW)).toBe(
      "delivered",
    );
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

describe("isRecentLook: the shared recovery window", () => {
  it("keys on when the look finished, so one started at 23:58 and finished at 00:02 is today's", () => {
    const row = succeededLook({
      created_at: iso(at(6, 23, 58)),
      completed_at: iso(at(7, 0, 2)),
    });
    expect(isRecentLook(row, at(7, 0, 5))).toBe(true);
  });

  it("keeps last night's look in the morning, within 12 hours", () => {
    const row = succeededLook({ created_at: iso(at(6, 23, 38)), completed_at: iso(at(6, 23, 40)) });
    expect(isRecentLook(row, at(7, 7, 40))).toBe(true);
  });

  it("lets a look go exactly at the 12 hour boundary when it is not from today", () => {
    const finished = at(6, 20, 0);
    const row = succeededLook({ created_at: iso(finished - 60_000), completed_at: iso(finished) });
    expect(isRecentLook(row, finished + 12 * 3_600_000)).toBe(true);
    expect(isRecentLook(row, finished + 12 * 3_600_000 + 60_000)).toBe(false);
  });

  it("measures the 12 hours from when it finished, not when it started", () => {
    const finished = at(6, 20, 0);
    const row = succeededLook({ created_at: iso(finished - 4 * 60_000), completed_at: iso(finished) });
    // 12 h 2 min after it started, 11 h 58 min after it finished.
    expect(isRecentLook(row, finished + 12 * 3_600_000 - 2 * 60_000)).toBe(true);
  });

  it("keeps a look from earlier today however long ago it finished", () => {
    const row = succeededLook({ created_at: iso(at(7, 0, 30)), completed_at: iso(at(7, 0, 31)) });
    expect(isRecentLook(row, at(7, 23, 59))).toBe(true);
  });

  it("falls back to when the job started when it has no finish time", () => {
    const row = succeededLook({ created_at: iso(at(7, 9, 0)), completed_at: null });
    expect(isRecentLook(row, at(7, 10, 0))).toBe(true);
    expect(isRecentLook(succeededLook({ created_at: "not a time", completed_at: null }), NOW)).toBe(false);
  });
});

describe("recoveredLookLabel", () => {
  it("says nothing for a look from today", () => {
    expect(recoveredLookLabel(at(7, 0, 2), at(7, 0, 5))).toBeNull();
  });

  it("names last night's look by its time, without a dash", () => {
    expect(recoveredLookLabel(at(6, 23, 40), at(7, 7, 40))).toBe("From last night, 11:40 PM");
    expect(recoveredLookLabel(at(6, 18, 5), at(7, 6, 0))).toBe("From last night, 6:05 PM");
  });

  it("names an earlier one from yesterday by its time", () => {
    expect(recoveredLookLabel(at(6, 13, 15), at(7, 0, 30))).toBe("From yesterday, 1:15 PM");
    expect(recoveredLookLabel(at(6, 12, 0), at(7, 0, 0))).toBe("From yesterday, 12:00 PM");
  });
});

describe("lookToRecover", () => {
  const base = {
    shownJobId: null,
    hasLookOnScreen: false,
    ownIds: [] as string[],
    followJobId: null,
    pressedHere: false,
    saved: false,
    nowMs: NOW,
  };

  it("brings back her latest finished look when nothing is on screen", () => {
    const row = succeededLook();
    expect(lookToRecover({ ...base, job: row })).toEqual({
      look: LOOK,
      jobId: "look-job",
      requestId: "request-look",
      own: false,
      finishedAt: NOW - 10_000,
      vibe: "Brunch",
      weather: "24°C Sunny (in Manila)",
    });
  });

  it("always lands her own unanswered press, even from another day", () => {
    const row = succeededLook({ created_at: iso(at(5, 9, 0)), completed_at: iso(at(5, 9, 2)) });
    expect(lookToRecover({ ...base, job: row, ownIds: ["request-look"], pressedHere: true })).toMatchObject({
      own: true,
      look: LOOK,
    });
  });

  it("lands the job the server told her press to follow, as not hers to draw", () => {
    const row = succeededLook({ client_request_id: "web-request" });
    expect(
      lookToRecover({ ...base, job: row, followJobId: "look-job", pressedHere: true }),
    ).toMatchObject({ own: false, look: LOOK });
  });

  it("never swaps a look already on screen", () => {
    expect(lookToRecover({ ...base, job: succeededLook(), hasLookOnScreen: true, shownJobId: "older" })).toBeNull();
    expect(lookToRecover({ ...base, job: succeededLook(), shownJobId: "look-job" })).toBeNull();
  });

  it("never lets someone else's job stand in for a press of hers that did not reach the server", () => {
    expect(lookToRecover({ ...base, job: succeededLook(), pressedHere: true, ownIds: ["mine"] })).toBeNull();
  });

  it("does not bring back a look she has saved, or one outside the window", () => {
    expect(lookToRecover({ ...base, job: succeededLook(), saved: true })).toBeNull();
    const old = succeededLook({ created_at: iso(at(6, 9, 0)), completed_at: iso(at(6, 9, 2)) });
    expect(lookToRecover({ ...base, job: old })).toBeNull();
  });

  it("brings back nothing for a running, failed, delivered or unreadable job", () => {
    for (const row of [
      job({}),
      job({ status: "failed", error_code: "deadline_exceeded" }),
      job({ status: "failed", error_code: "persist_failed_delivered" }),
      succeededLook({ result: { outfit: "?" } }),
      null,
    ]) {
      expect(lookToRecover({ ...base, job: row, ownIds: ["request-look"] })).toBeNull();
    }
  });
});

describe("lookInProgress", () => {
  const base = { ownIds: [] as string[], followJobId: null, pressedHere: false, hasLookOnScreen: false, nowMs: NOW };

  it("shows her own running job, and one she was told to follow", () => {
    expect(lookInProgress({ ...base, job: job({}), ownIds: ["request-look"], pressedHere: true })).toEqual({
      composing: true,
      own: true,
    });
    expect(
      lookInProgress({ ...base, job: job({ client_request_id: "web" }), followJobId: "look-job", pressedHere: true }),
    ).toEqual({ composing: true, own: false });
  });

  it("shows a running job from elsewhere only on an empty screen", () => {
    expect(lookInProgress({ ...base, job: job({}) })).toEqual({ composing: true, own: false });
    expect(lookInProgress({ ...base, job: job({}), hasLookOnScreen: true })).toEqual({
      composing: false,
      own: false,
    });
    expect(lookInProgress({ ...base, job: job({}), pressedHere: true })).toEqual({ composing: false, own: false });
  });

  it("never shows a dead or settled job as running", () => {
    expect(lookInProgress({ ...base, job: job({ deadline_at: iso(NOW - 120_000) }) }).composing).toBe(false);
    expect(lookInProgress({ ...base, job: succeededLook() }).composing).toBe(false);
    expect(lookInProgress({ ...base, job: null }).composing).toBe(false);
  });
});

describe("failureNotice", () => {
  it("says her credit is back only when the row says it was refunded", () => {
    expect(failureNotice(job({ status: "failed", error_code: "deadline_exceeded", credit_state: "refunded" }))).toBe(
      "Mila couldn't finish your look. Your credit is back.",
    );
    expect(failureNotice(job({ status: "failed", error_code: "render_failed", credit_state: "charged" }))).toBe(
      "Mila couldn't finish your look. Please try again.",
    );
  });

  it("is silent for a delivered, succeeded or running job", () => {
    expect(failureNotice(job({ status: "failed", error_code: "persist_failed_delivered" }))).toBeNull();
    expect(failureNotice(succeededLook())).toBeNull();
    expect(failureNotice(job({}))).toBeNull();
  });
});

describe("lookAlreadySaved", () => {
  const row = succeededLook({ created_at: iso(NOW - 600_000) });

  it("finds a history row with this look's headline saved since the job started", () => {
    expect(
      lookAlreadySaved([{ analysis_result: LOOK, created_at: iso(NOW - 60_000) }], row, LOOK),
    ).toBe(true);
  });

  it("ignores other looks and rows saved before the job", () => {
    expect(lookAlreadySaved([{ analysis_result: OTHER_LOOK, created_at: iso(NOW) }], row, LOOK)).toBe(false);
    expect(lookAlreadySaved([{ analysis_result: LOOK, created_at: iso(NOW - 3_600_000) }], row, LOOK)).toBe(false);
    expect(lookAlreadySaved(undefined, row, LOOK)).toBe(false);
  });
});

describe("weather of a recovered look", () => {
  it("shows the weather it was composed for, and saves it the way History does", () => {
    expect(weatherBadgeOf("24°C Sunny (in Manila)")).toBe("24°C Sunny");
    expect(savedWeatherOf("24°C Sunny (in Manila)")).toBe("24°C Sunny (Manila)");
    expect(weatherBadgeOf(null)).toBeNull();
    expect(savedWeatherOf("Mild")).toBe("Mild");
  });
});

describe("lookKeyOf", () => {
  it("is a short stable fingerprint of the look, not its words", () => {
    expect(lookKeyOf(LOOK)).toMatch(/^[0-9a-f]{14}$/);
    expect(lookKeyOf({ ...LOOK })).toBe(lookKeyOf(LOOK));
    expect(lookKeyOf(OTHER_LOOK)).not.toBe(lookKeyOf(LOOK));
    // The same headline with a different description is a different look.
    expect(lookKeyOf({ outfit: { ...LOOK.outfit, description: "A heavier layer." } })).not.toBe(lookKeyOf(LOOK));
    expect(lookKeyOf(LOOK)).not.toContain("Linen");
  });
});

describe("jobIsForLook", () => {
  it("matches a render to the look it was drawn for, by headline and description", () => {
    expect(jobIsForLook(sheetFor(LOOK), LOOK)).toBe(true);
    expect(jobIsForLook(sheetFor(LOOK), OTHER_LOOK)).toBe(false);
    expect(jobIsForLook(sheetFor(LOOK, { for_look: null }), LOOK)).toBe(false);
    expect(jobIsForLook(null, LOOK)).toBe(false);
  });
});

describe("recoverVisual", () => {
  it("belongs to the look it was drawn for, never to one shown after it", () => {
    expect(recoverVisual({ job: sheetFor(LOOK), action: null, look: LOOK, nowMs: NOW })).toEqual({
      rendering: true,
      succeededJob: null,
      failed: false,
    });
    // A newer render for a different look, from another device: not this look's.
    expect(recoverVisual({ job: sheetFor(OTHER_LOOK), action: null, look: LOOK, nowMs: NOW })).toEqual({
      rendering: false,
      succeededJob: null,
      failed: false,
    });
    expect(recoverVisual({ job: sheetFor(LOOK), action: null, look: null, nowMs: NOW })).toEqual({
      rendering: false,
      succeededJob: null,
      failed: false,
    });
  });

  it("hands over a succeeded render's row only when it has an image", () => {
    const done = sheetFor(LOOK, { status: "succeeded", image_path: "member/sheet-job.jpg" });
    expect(recoverVisual({ job: done, action: null, look: LOOK, nowMs: NOW }).succeededJob).toBe(done);
    expect(
      recoverVisual({ job: sheetFor(LOOK, { status: "succeeded" }), action: null, look: LOOK, nowMs: NOW })
        .succeededJob,
    ).toBeNull();
  });

  it("says a failed render failed, and a delivered one did not", () => {
    expect(
      recoverVisual({
        job: sheetFor(LOOK, { status: "failed", error_code: "qa_failed" }),
        action: null,
        look: LOOK,
        nowMs: NOW,
      }),
    ).toEqual({ rendering: false, succeededJob: null, failed: true });
    expect(
      recoverVisual({
        job: sheetFor(LOOK, { status: "failed", error_code: "persist_failed_delivered" }),
        action: { clientRequestId: "request-sheet" },
        look: LOOK,
        nowMs: NOW,
      }),
    ).toEqual({ rendering: false, succeededJob: null, failed: false });
  });

  it("follows only her own press when she made one, and only for this look", () => {
    expect(
      recoverVisual({ job: sheetFor(LOOK), action: { clientRequestId: "another-press" }, look: LOOK, nowMs: NOW }),
    ).toEqual({ rendering: false, succeededJob: null, failed: false });
    expect(
      recoverVisual({ job: sheetFor(LOOK), action: { clientRequestId: "request-sheet" }, look: LOOK, nowMs: NOW })
        .rendering,
    ).toBe(true);
    expect(
      recoverVisual({
        job: sheetFor(OTHER_LOOK),
        action: { clientRequestId: "request-sheet" },
        look: LOOK,
        nowMs: NOW,
      }).rendering,
    ).toBe(false);
  });
});

describe("sheetNeverDrawn", () => {
  it("is true when no sheet was started for this look, or one was delivered elsewhere and not kept", () => {
    expect(sheetNeverDrawn(null, LOOK)).toBe(true);
    expect(sheetNeverDrawn(sheetFor(OTHER_LOOK), LOOK)).toBe(true);
    expect(sheetNeverDrawn(sheetFor(LOOK, { status: "failed", error_code: "persist_failed_delivered" }), LOOK)).toBe(
      true,
    );
  });

  it("is false once a sheet for this look ran, failed or succeeded", () => {
    expect(sheetNeverDrawn(sheetFor(LOOK), LOOK)).toBe(false);
    expect(sheetNeverDrawn(sheetFor(LOOK, { status: "failed", error_code: "qa_failed" }), LOOK)).toBe(false);
    expect(sheetNeverDrawn(sheetFor(LOOK, { status: "succeeded", image_path: "member/s.jpg" }), LOOK)).toBe(false);
  });
});

import {
  RECENT_LOOKS_LIMIT,
  looksThisMonth,
  recentLooks,
  styleProfileCompletionPercent,
} from "@/lib/dashboard-stats";
import type { StyleProfileRow } from "@/lib/style-profile/completion";
import type { OutfitRow } from "@/services/supabase/outfits";

const emptyProfile: StyleProfileRow = {
  skin_undertone: null,
  color_season: null,
  body_type: null,
  face_shape: null,
  hair_type: null,
  hair_length: null,
  gender: null,
  skin_depth: null,
  color_profile: null,
};

const fullProfile: StyleProfileRow = {
  skin_undertone: "Warm",
  color_season: "Autumn",
  body_type: "Hourglass",
  face_shape: "Oval",
  hair_type: "Wavy",
  hair_length: "Long",
  gender: "Female",
  skin_depth: "Medium",
  color_profile: { season: "Autumn" },
};

function outfit(id: string, createdAt: string): OutfitRow {
  return { id, image_url: `https://example.test/${id}.jpg`, analysis_result: null, match_score: null, created_at: createdAt };
}

describe("styleProfileCompletionPercent", () => {
  it("scores an absent or unanswered profile at zero", () => {
    expect(styleProfileCompletionPercent(null)).toBe(0);
    expect(styleProfileCompletionPercent(emptyProfile)).toBe(0);
  });

  it("scores a fully answered profile at 100", () => {
    expect(styleProfileCompletionPercent(fullProfile)).toBe(100);
  });

  // Rounds like the web's — the same profile must read the same number on both.
  it("rounds a partial profile, and counts each field once", () => {
    expect(styleProfileCompletionPercent({ ...fullProfile, face_shape: null })).toBe(89);
    expect(styleProfileCompletionPercent({ ...fullProfile, face_shape: "Rectangular" })).toBe(89);
  });

  // A colour dossier is the field the rest of the app leans on hardest: a
  // season string alone does not make it present.
  it("requires a colour dossier, not merely a season column", () => {
    expect(styleProfileCompletionPercent({ ...fullProfile, color_profile: {} })).toBe(89);
    expect(styleProfileCompletionPercent({ ...fullProfile, color_profile: [] })).toBe(89);
  });
});

describe("recentLooks", () => {
  it("keeps the newest first and caps the strip at the web's count", () => {
    const rows = Array.from({ length: RECENT_LOOKS_LIMIT + 4 }, (_, index) =>
      outfit(String(index), `2026-10-0${(index % 9) + 1}T10:00:00.000Z`),
    );

    const recent = recentLooks(rows);

    expect(recent).toHaveLength(RECENT_LOOKS_LIMIT);
    expect(recent.map((row) => row.id)).toEqual(rows.slice(0, RECENT_LOOKS_LIMIT).map((r) => r.id));
  });

  it("returns what there is when there are fewer than the cap", () => {
    expect(recentLooks([outfit("a", "2026-10-01T10:00:00.000Z")])).toHaveLength(1);
    expect(recentLooks([])).toEqual([]);
  });
});

describe("looksThisMonth", () => {
  it("counts from the first instant of the month, ignoring what precedes it", () => {
    const now = new Date("2026-10-02T09:00:00.000Z");
    // The web's boundary is local midnight on the 1st; build the rows off the
    // same boundary so the test does not depend on the host's timezone.
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const rows = [
      outfit("at-the-boundary", monthStart.toISOString()),
      outfit("a-second-before", new Date(monthStart.getTime() - 1000).toISOString()),
      outfit("summer", "2026-07-14T12:00:00.000Z"),
    ];

    expect(looksThisMonth(rows, now)).toBe(1);
  });

  it("is zero for a member who has never saved a look", () => {
    expect(looksThisMonth([], new Date("2026-10-02T09:00:00.000Z"))).toBe(0);
  });
});

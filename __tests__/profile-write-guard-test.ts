import { assertWritableColumns } from "@/lib/profile-columns";
import { PROFILE_WRITABLE_COLUMNS } from "@/types/models";

/**
 * §7: a member is granted UPDATE on a fixed column list. `suspended` and
 * `paddle_customer_id` are not on it, and attempting either fails the grant —
 * it does not silently no-op. The type system stops the literal case; this
 * stops the spread case, which the compiler waves through.
 */
describe("assertWritableColumns", () => {
  it("allows every permitted column, together", () => {
    const everything = Object.fromEntries(PROFILE_WRITABLE_COLUMNS.map((c) => [c, null]));
    expect(() => assertWritableColumns(everything)).not.toThrow();
  });

  it("allows the payloads onboarding actually sends", () => {
    expect(() => assertWritableColumns({ body_type: "Hourglass" })).not.toThrow();
    expect(() =>
      assertWritableColumns({
        skin_undertone: "Warm",
        color_season: "Autumn",
        color_profile: { season: "Autumn" },
      }),
    ).not.toThrow();
    expect(() => assertWritableColumns({})).not.toThrow();
  });

  it.each(["suspended", "paddle_customer_id", "id", "created_at"])(
    "refuses to send %s",
    (column) => {
      // A spread of a wider object — the case TypeScript does not catch.
      const wider = { body_type: "Hourglass", [column]: true } as Record<string, unknown>;
      expect(() => assertWritableColumns(wider)).toThrow(new RegExp(column));
    },
  );

  it("names every offending column, not just the first", () => {
    const wider = { suspended: true, paddle_customer_id: "x" } as Record<string, unknown>;
    expect(() => assertWritableColumns(wider)).toThrow(/suspended.*paddle_customer_id/);
  });

  it("keeps the permitted list in step with §7", () => {
    // Adding a column here without a line in the architecture doc's §7 table is
    // how a client quietly acquires a write it was never granted.
    //
    // `photo_consent_at` and `profile_photo_path` were added for the selfie
    // widget (ported from the web dashboard); `skin_depth`, `height_cm`, and
    // `weight_kg` for the matching onboarding steps — confirmed live against
    // the database that `authenticated` already holds UPDATE on all five,
    // same as every other column here.
    expect([...PROFILE_WRITABLE_COLUMNS].sort()).toEqual(
      [
        "beauty_preferences",
        "body_type",
        "color_profile",
        "color_season",
        "default_location",
        "face_shape",
        "full_name",
        "hair_type",
        "height_cm",
        "photo_consent_at",
        "profile_photo_path",
        "skin_depth",
        "skin_undertone",
        "style_goals",
        "updated_at",
        "username",
        "weight_kg",
      ].sort(),
    );
    expect(PROFILE_WRITABLE_COLUMNS).not.toContain("suspended");
    expect(PROFILE_WRITABLE_COLUMNS).not.toContain("paddle_customer_id");
  });
});

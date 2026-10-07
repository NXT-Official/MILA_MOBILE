import { queryKeys } from "@/constants/query-keys";
import { assertWritableColumns } from "@/lib/profile-columns";
import { PROFILE_READ_COLUMNS, PROFILE_WRITABLE_COLUMNS } from "@/types/models";

/**
 * Wave D columns arrive in a migration that may not be applied yet. A missing
 * column in the launch read would break every profile read and the launch gate
 * (plan 3.2), so those columns are read only through the guarded
 * profile-extras module and never selected here.
 */
describe("Wave D profile columns", () => {
  const WAVE_D = ["hair_color", "last_check_in_at", "founding_body_read_at"];

  it("the launch profile read never selects a Wave D column", () => {
    const selected = PROFILE_READ_COLUMNS.split(",");
    for (const column of WAVE_D) expect(selected).not.toContain(column);
  });

  it("lets a member write hair_color and last_check_in_at", () => {
    expect(PROFILE_WRITABLE_COLUMNS).toContain("hair_color");
    expect(PROFILE_WRITABLE_COLUMNS).toContain("last_check_in_at");
    expect(() => assertWritableColumns({ hair_color: "Auburn", last_check_in_at: "x" })).not.toThrow();
  });

  it("never lets a member write the service-role-only column", () => {
    expect(PROFILE_WRITABLE_COLUMNS).not.toContain("founding_body_read_at");
    expect(() => assertWritableColumns({ founding_body_read_at: "x" })).toThrow(/founding_body_read_at/);
  });

  it("has explicit query keys for the extras and the analysis job", () => {
    expect(queryKeys.profileExtras("u1")).toEqual(["profile-extras", "u1"]);
    expect(queryKeys.analysisJob("u1", "check_in")).toEqual(["analysis-job", "u1", "check_in"]);
  });
});

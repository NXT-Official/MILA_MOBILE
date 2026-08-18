import { LENS_MODES, toLensMode } from "@/features/lens/modes";

/**
 * The mode reaches the capture screen through a URL search param, so it is
 * member-supplied text by the time it is read. Anything that is not a real mode
 * has to land on the analysis read — never on an empty screen.
 */
describe("toLensMode", () => {
  it("keeps the two real modes", () => {
    expect(toLensMode("analysis")).toBe("analysis");
    expect(toLensMode("dupe")).toBe("dupe");
  });

  it("falls back to the analysis read for anything else", () => {
    for (const value of [undefined, null, "", "DUPE", "hunter", 1, {}]) {
      expect(toLensMode(value)).toBe("analysis");
    }
  });

  it("offers exactly the modes the sheet toggles between", () => {
    expect(LENS_MODES.map((mode) => mode.id)).toEqual(["analysis", "dupe"]);
  });
});

import { firstName, greeting, greetingPrefix } from "@/lib/greeting";

/** The four clock positions the Phase 03 checklist calls out by name. */
describe("greetingPrefix", () => {
  it("uses the four §3 thresholds", () => {
    expect(greetingPrefix(4)).toBe("Still up");
    expect(greetingPrefix(9)).toBe("Good morning");
    expect(greetingPrefix(15)).toBe("Good afternoon");
    expect(greetingPrefix(21)).toBe("Good evening");
  });

  it("flips exactly on the boundary, not around it", () => {
    expect(greetingPrefix(0)).toBe("Still up");
    expect(greetingPrefix(5)).toBe("Good morning");
    expect(greetingPrefix(11)).toBe("Good morning");
    expect(greetingPrefix(12)).toBe("Good afternoon");
    expect(greetingPrefix(17)).toBe("Good afternoon");
    expect(greetingPrefix(18)).toBe("Good evening");
    expect(greetingPrefix(23)).toBe("Good evening");
  });
});

describe("firstName", () => {
  it("takes the first word", () => {
    expect(firstName("Ana Maria Cruz")).toBe("Ana");
    expect(firstName("Ana")).toBe("Ana");
  });

  it("returns null for anything that would leave a dangling comma", () => {
    expect(firstName(null)).toBeNull();
    expect(firstName(undefined)).toBeNull();
    expect(firstName("")).toBeNull();
    expect(firstName("   ")).toBeNull();
  });

  it("ignores leading whitespace rather than returning an empty first word", () => {
    expect(firstName("  Ana Maria")).toBe("Ana");
  });
});

describe("greeting", () => {
  const at = (hour: number) => new Date(2026, 0, 15, hour, 0, 0);

  it("suffixes the first name when there is one", () => {
    expect(greeting(at(9), "Ana Maria Cruz")).toBe("Good morning, Ana");
    expect(greeting(at(21), "Ana")).toBe("Good evening, Ana");
  });

  it("stands alone when there is no usable name", () => {
    expect(greeting(at(4), null)).toBe("Still up");
    expect(greeting(at(15), "  ")).toBe("Good afternoon");
  });
});

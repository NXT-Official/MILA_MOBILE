import {
  MAX_HISTORY_MESSAGES,
  conversationTitle,
  toHistory,
  type ChatRole,
} from "@/lib/concierge-history";

function turn(role: ChatRole, content: string, failed = false) {
  return { role, content, failed };
}

/** A thread of `count` alternating messages, numbered so order is checkable. */
function thread(count: number) {
  return Array.from({ length: count }, (_, i) =>
    turn(i % 2 === 0 ? "user" : "assistant", `m${i}`),
  );
}

describe("toHistory", () => {
  it("sends a short thread unchanged, oldest first", () => {
    expect(toHistory(thread(4))).toEqual([
      { role: "user", content: "m0" },
      { role: "assistant", content: "m1" },
      { role: "user", content: "m2" },
      { role: "assistant", content: "m3" },
    ]);
  });

  it("caps at 12 messages", () => {
    expect(toHistory(thread(40))).toHaveLength(MAX_HISTORY_MESSAGES);
  });

  it("keeps the NEWEST twelve, not the oldest", () => {
    // The failure this guards: trimming from the wrong end sends Mila the start
    // of a long conversation and she answers a question already resolved.
    const kept = toHistory(thread(40));
    expect(kept[kept.length - 1].content).toBe("m39");
    expect(kept[0].content).toBe("m28");
  });

  it("still returns oldest-first after trimming", () => {
    const kept = toHistory(thread(40));
    const numbers = kept.map((m) => Number(m.content.slice(1)));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it("drops a failed send, which Mila never saw", () => {
    const kept = toHistory([
      turn("user", "kept"),
      turn("user", "never arrived", true),
      turn("assistant", "reply"),
    ]);
    expect(kept.map((m) => m.content)).toEqual(["kept", "reply"]);
  });

  it("drops blank content rather than sending an empty turn", () => {
    expect(toHistory([turn("user", "   "), turn("assistant", "reply")])).toEqual([
      { role: "assistant", content: "reply" },
    ]);
  });

  it("stops at the character budget, keeping the newest that fit", () => {
    const kept = toHistory(
      [turn("user", "x".repeat(5000)), turn("assistant", "recent")],
      12,
      6000,
    );
    expect(kept).toEqual([
      { role: "user", content: "x".repeat(5000) },
      { role: "assistant", content: "recent" },
    ]);
  });

  it("drops an oversized older message rather than sending nothing", () => {
    const kept = toHistory(
      [turn("user", "x".repeat(7000)), turn("assistant", "recent")],
      12,
      6000,
    );
    expect(kept).toEqual([{ role: "assistant", content: "recent" }]);
  });

  it("returns nothing for an empty thread", () => {
    expect(toHistory([])).toEqual([]);
  });
});

describe("conversationTitle", () => {
  it("uses the opening message", () => {
    expect(conversationTitle("What should I wear to a dinner?")).toBe(
      "What should I wear to a dinner?",
    );
  });

  it("collapses whitespace so a pasted message does not become a ragged title", () => {
    expect(conversationTitle("  what   should\nI wear? ")).toBe("what should I wear?");
  });

  it("truncates to the column's 120-character limit", () => {
    // Not cosmetic: an untrimmed title is a failed insert, and the turn has
    // already been paid for by the time it runs.
    const title = conversationTitle("y".repeat(300));
    expect(title.length).toBeLessThanOrEqual(120);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back rather than writing an empty title", () => {
    expect(conversationTitle("   ")).toBe("New conversation");
  });
});

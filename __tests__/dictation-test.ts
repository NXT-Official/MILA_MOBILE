import { composeTranscript, dictationErrorCopy } from "@/lib/dictation";

describe("composeTranscript", () => {
  it("returns the transcript alone when the box was empty", () => {
    expect(composeTranscript("", "what should I wear")).toBe("what should I wear");
  });

  it("keeps what she typed and appends what she said", () => {
    expect(composeTranscript("Hi Mila,", "what should I wear")).toBe(
      "Hi Mila, what should I wear",
    );
  });

  it("replaces the previous transcript rather than appending to it", () => {
    // The recogniser revises its own result: the second call carries the whole
    // sentence, not the new words. Appending would leave both.
    const base = "Hi Mila,";
    expect(composeTranscript(base, "what should I wear to")).toBe("Hi Mila, what should I wear to");
    expect(composeTranscript(base, "what should I wear to dinner")).toBe(
      "Hi Mila, what should I wear to dinner",
    );
  });

  it("adds no stray space before the first word", () => {
    expect(composeTranscript("", "")).toBe("");
    expect(composeTranscript("Hi Mila,", "")).toBe("Hi Mila,");
  });
});

describe("dictationErrorCopy", () => {
  it("names what she can do for a known code", () => {
    expect(dictationErrorCopy("not-allowed")).toMatch(/Settings/);
    expect(dictationErrorCopy("network")).toMatch(/connection/);
  });

  it("degrades an unknown code to plain language, never the code itself", () => {
    const copy = dictationErrorCopy("some-future-code");
    expect(copy).not.toMatch(/some-future-code/);
    expect(copy).toMatch(/type instead/);
  });
});

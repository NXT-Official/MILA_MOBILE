import { scrubSentryEvent, scrubText } from "./scrub";

describe("scrubText", () => {
  it("masks email addresses", () => {
    expect(scrubText("failed for ana.cruz+x@example.com today")).toBe(
      "failed for [email] today",
    );
  });

  it("masks JWTs and bearer tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl";
    expect(scrubText(`token ${jwt} end`)).toBe("token [jwt] end");
    expect(scrubText("Authorization: Bearer abc.def-123")).toBe(
      "Authorization: Bearer [token]",
    );
  });

  it("masks data URIs and long base64 runs", () => {
    expect(scrubText("img data:image/png;base64,AAAA/BBBB== done")).toBe(
      "img [data-uri] done",
    );
    expect(scrubText(`blob ${"A".repeat(200)}`)).toBe("blob [base64]");
  });

  it("drops credentials from URLs: sensitive params and the fragment", () => {
    expect(
      scrubText(
        "GET https://x.test/cb?code=abc&page=2&access_token=zzz#refresh_token=q",
      ),
    ).toBe("GET https://x.test/cb?page=2");
  });

  it("leaves ordinary text alone", () => {
    expect(scrubText("Look generation failed (500)")).toBe(
      "Look generation failed (500)",
    );
  });
});

describe("scrubSentryEvent", () => {
  it("keeps only the user id and scrubs nested strings", () => {
    const event = scrubSentryEvent({
      user: { id: "u1", email: "a@b.co", ip_address: "1.2.3.4", username: "ana" },
      message: "hi a@b.co",
      exception: { values: [{ value: "bad token a@b.co" }] },
      breadcrumbs: [{ message: "nav", data: { url: "mila://x?code=1" } }],
      request: { url: "https://x.test/?token=abc", cookies: { s: "1" } },
    });
    expect(event?.user).toEqual({ id: "u1" });
    expect(event?.message).toBe("hi [email]");
    expect(event?.exception?.values?.[0]?.value).toBe("bad token [email]");
    expect(event?.breadcrumbs?.[0]?.data?.url).toBe("mila://x");
    expect(event?.request?.url).toBe("https://x.test/");
    expect(event?.request?.cookies).toBeUndefined();
  });

  it("drops the event rather than sending it unscrubbed when scrubbing throws", () => {
    const hostile = {} as Record<string, unknown>;
    Object.defineProperty(hostile, "message", {
      enumerable: true,
      get() {
        throw new Error("boom");
      },
    });
    expect(scrubSentryEvent(hostile)).toBeNull();
  });
});

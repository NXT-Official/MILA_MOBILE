import { scrubPath, scrubSentryEvent, scrubText } from "./scrub";

describe("scrubText URL handling (shared allowlist sanitizer)", () => {
  it("keeps only allowlisted params, so an unlisted credential param cannot leak", () => {
    expect(
      scrubText("see https://x.test/p?otp=S1&jwt=S2&key=S3&utm_source=mail&sort=asc"),
    ).toBe("see https://x.test/p?utm_source=mail&sort=asc");
  });

  it.each([
    ["double-encoded name", "https://x.test/p?%2563ode=SECRET"],
    ["space in name", "https://x.test/p?code%20=SECRET"],
    ["plus in name", "https://x.test/p?code+=SECRET"],
    ["semicolon separator", "https://x.test/p?a=1;code=SECRET"],
    ["bare key without =", "https://x.test/p?SECRET"],
    ["token nested in a kept param", "https://x.test/p?page=%2Fauth%3Fcode%3DSECRET"],
    ["encoded # inside the path", "https://x.test/callback%23access_token=SECRET"],
    ["token in a path segment", "https://x.test/auth/confirm/SECRETSECRETSECRETSECRET1234"],
    ["token in a custom-scheme host", "mila://SECRETSECRETSECRETSECRET1234"],
    ["bare path, encoded name", "/p?%2563ode=SECRET"],
    ["bare path, token segment", "/auth/confirm/SECRETSECRETSECRETSECRET1234"],
  ])("does not leak a token: %s", (_name, url) => {
    expect(scrubText(`GET ${url} failed`)).not.toContain("SECRET");
  });

  it("drops the whole query on auth routes and auth deep links", () => {
    expect(scrubText("at mila://auth/callback?utm_source=x&code=S")).toBe(
      "at mila://auth/callback",
    );
    expect(scrubText("at https://x.test/auth/reset-password?page=2")).toBe(
      "at https://x.test/auth/reset-password",
    );
  });

  it("replaces token-shaped path segments with a placeholder", () => {
    expect(
      scrubText("https://x.test/files/abcdefghijklmnopqrstuvwxyz0123"),
    ).toBe("https://x.test/files/:token");
  });

  it("sanitizes bare paths with no scheme", () => {
    expect(scrubText("/auth/callback?code=abc")).toBe("/auth/callback");
    expect(scrubText("failed at /look/list?page=2&code=abc")).toBe(
      "failed at /look/list?page=2",
    );
    expect(scrubText("url=/auth/callback?code=abc#access_token=z")).toBe(
      "url=/auth/callback",
    );
  });

  it("uses the same sanitizer as PostHog for screen paths", () => {
    expect(scrubPath("/auth/callback?code=abc#access_token=z")).toBe("/auth/callback");
  });
});

describe("scrubSentryEvent depth limit", () => {
  it("fails closed past the limit: never passes the raw object through", () => {
    let deep: Record<string, unknown> = { secret: "a@b.co" };
    for (let i = 0; i < 12; i += 1) deep = { n: deep };
    const out = JSON.stringify(scrubSentryEvent(deep));
    expect(out).toContain("[truncated]");
    expect(out).not.toContain("a@b.co");
  });
});

import { sanitizePosthogEvent } from "@/services/posthog";

type CaptureEvent = NonNullable<Parameters<typeof sanitizePosthogEvent>[0]>;

function event(name: string, properties: NonNullable<CaptureEvent["properties"]>): CaptureEvent {
  return { uuid: "u", event: name, properties };
}

describe("before_send upgrades", () => {
  test("$screen_name masks id-like segments and strips ? and #", () => {
    const r = sanitizePosthogEvent(
      event("$screen", { $screen_name: "/look/550e8400-e29b-41d4-a716-446655440000?x=1#y" }),
    );
    expect(r?.properties?.$screen_name).toBe("/look/:token");
  });

  test("any string property that is a URL is sanitized, whatever its key", () => {
    const r = sanitizePosthogEvent(
      event("product_saved", {
        shop_link: "https://shop.example/p?code=SUMMER&utm_source=a",
        deep: "mila://auth/callback?code=SECRET",
        nested: { link: "https://x.test/a?token=SECRET" },
        list: ["https://x.test/b?otp=SECRET"],
      }),
    );
    expect(r?.properties?.shop_link).toBe("https://shop.example/p?utm_source=a");
    expect(r?.properties?.deep).toBe("mila://auth/callback");
    expect(JSON.stringify(r?.properties)).not.toContain("SECRET");
  });

  test("non-URL strings are left alone apart from email masking", () => {
    const r = sanitizePosthogEvent(
      event("custom", { note: "plain words", who: "mail nicole@example.com now", n: 3 }),
    );
    expect(r?.properties?.note).toBe("plain words");
    expect(r?.properties?.who).toBe("mail [email] now");
    expect(r?.properties?.n).toBe(3);
  });

  test("emails inside URL properties are masked", () => {
    const r = sanitizePosthogEvent(event("$pageview", { $current_url: "https://m.app/u/a@b.co" }));
    expect(r?.properties?.$current_url).toBe("https://m.app/u/[email]");
  });
});

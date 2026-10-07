import { sanitizePosthogEvent, sanitizeUrl } from "@/services/posthog";

type CaptureEvent = NonNullable<Parameters<typeof sanitizePosthogEvent>[0]>;

function event(
  name: string,
  properties: NonNullable<CaptureEvent["properties"]>,
  extra: Partial<Pick<CaptureEvent, "$set" | "$set_once">> = {},
): CaptureEvent {
  return { uuid: "0198-uuid", event: name, properties, ...extra };
}

describe("sanitizeUrl: auth credentials never reach analytics", () => {
  test("a custom-scheme callback carrying the session in the fragment keeps only scheme, host and path", () => {
    const url =
      "mila://auth/callback#access_token=AT-secret&refresh_token=RT-secret&expires_in=3600&token_type=bearer&type=recovery";
    const clean = sanitizeUrl(url);
    expect(clean).toBe("mila://auth/callback");
    expect(clean).not.toContain("AT-secret");
    expect(clean).not.toContain("RT-secret");
  });

  test("a ?code= deep link loses the code and keeps other params", () => {
    expect(sanitizeUrl("mila://auth/callback?code=pkce-secret")).toBe(
      "mila://auth/callback",
    );
    expect(
      sanitizeUrl("mila://auth/callback?code=pkce-secret&utm_source=email"),
    ).toBe("mila://auth/callback?utm_source=email");
  });

  test("a ?token_hash= universal link loses the hash and the type", () => {
    const clean = sanitizeUrl(
      "https://mila.app/auth/confirm?token_hash=th-secret&type=signup",
    );
    expect(clean).toBe("https://mila.app/auth/confirm");
    expect(clean).not.toContain("th-secret");
  });

  test("the return path (?redirect=) and an email param are removed", () => {
    expect(
      sanitizeUrl("mila://login?redirect=%2Fcloset&email=n%40example.com"),
    ).toBe("mila://login");
  });

  test("every sensitive param is removed regardless of case, and ordinary params survive", () => {
    const url =
      "mila://x?Access_Token=a&CODE=b&Redirect=%2Fy&NEXT=%2Fz&Email=n%40example.com" +
      "&error_description=bad+link&token=c&TYPE=d&refresh_token=e&token_hash=f&keep=1";
    expect(sanitizeUrl(url)).toBe("mila://x?keep=1");
  });

  test("a percent-encoded param name cannot smuggle a sensitive key past the filter", () => {
    expect(sanitizeUrl("mila://x?%63ode=secret&keep=1")).toBe(
      "mila://x?keep=1",
    );
  });

  test("a valueless sensitive param is removed too", () => {
    expect(sanitizeUrl("mila://x?code&keep=1")).toBe("mila://x?keep=1");
  });

  test("an Expo dev-client deep link keeps host, port and path", () => {
    expect(
      sanitizeUrl("exp://192.168.1.5:8081/--/auth/callback#access_token=AT"),
    ).toBe("exp://192.168.1.5:8081/--/auth/callback");
  });

  test("an ordinary URL is left unchanged", () => {
    for (const url of [
      "mila://closet",
      "mila://look/8c1f?from=feed",
      "https://mila.app/closet?tab=outfits&sort=new",
    ]) {
      expect(sanitizeUrl(url)).toBe(url);
    }
  });

  test("remaining params keep their original encoding", () => {
    expect(sanitizeUrl("mila://search?q=a%20b+c&code=1")).toBe(
      "mila://search?q=a%20b+c",
    );
  });

  test("embedded credentials (userinfo) are dropped", () => {
    expect(sanitizeUrl("https://user:pw@mila.app/x?code=1")).toBe(
      "https://mila.app/x",
    );
  });

  test("a bare path is sanitized, not rejected", () => {
    expect(sanitizeUrl("/auth/callback?code=1#a=b")).toBe("/auth/callback");
    expect(sanitizeUrl("/closet")).toBe("/closet");
  });

  test("unparseable input becomes a fixed placeholder, never the raw string", () => {
    expect(sanitizeUrl("not a url")).toBe("[unparseable-url]");
    expect(sanitizeUrl("")).toBe("[unparseable-url]");
    expect(sanitizeUrl("access_token=leaky")).toBe("[unparseable-url]");
    expect(sanitizeUrl("mailto:nicole@example.com")).toBe("[unparseable-url]");
    expect(sanitizeUrl("mila://")).toBe("[unparseable-url]");
  });

  test("sanitizing twice changes nothing", () => {
    const once = sanitizeUrl(
      "mila://auth/callback?code=1&keep=2#access_token=3",
    );
    expect(sanitizeUrl(once)).toBe(once);
  });
});

describe("sanitizePosthogEvent: the before_send hook scrubs every event", () => {
  const leaky =
    "mila://auth/callback?code=pkce-secret&keep=1#access_token=AT-secret";
  const clean = "mila://auth/callback?keep=1";

  test("Application Opened carries the cold-start deep link in `url`: it is sanitized", () => {
    const result = sanitizePosthogEvent(
      event("Application Opened", {
        url: "mila://auth/callback#access_token=AT-secret&refresh_token=RT-secret",
        from_background: false,
        version: "1.4.0",
      }),
    );
    expect(result?.properties).toEqual({
      url: "mila://auth/callback",
      from_background: false,
      version: "1.4.0",
    });
  });

  test("a screen name never keeps a query or fragment", () => {
    const result = sanitizePosthogEvent(
      event("$screen", {
        $screen_name: "/reset-password?token_hash=th-secret&email=a%40b.co#x",
      }),
    );
    expect(result?.properties?.$screen_name).toBe("/reset-password");
  });

  test("a plain screen name is untouched", () => {
    const result = sanitizePosthogEvent(
      event("$screen", { $screen_name: "/look/8c1f" }),
    );
    expect(result?.properties?.$screen_name).toBe("/look/8c1f");
  });

  test("web-style URL properties are sanitized if they ever appear", () => {
    const result = sanitizePosthogEvent(
      event("custom", {
        $current_url: leaky,
        $referrer: leaky,
        $pathname: "/auth/callback?code=1",
        $initial_current_url: leaky,
        $initial_referrer: leaky,
      }),
    );
    expect(result?.properties).toEqual({
      $current_url: clean,
      $referrer: clean,
      $pathname: "/auth/callback",
      $initial_current_url: clean,
      $initial_referrer: clean,
    });
  });

  test("sanitizes person properties at the top level and under properties.$set / $set_once", () => {
    const result = sanitizePosthogEvent(
      event(
        "$identify",
        {
          $set: { $current_url: leaky },
          $set_once: { $initial_current_url: leaky },
        },
        {
          $set: { $current_url: leaky },
          $set_once: { $initial_referrer: leaky },
        },
      ),
    );
    expect(result?.$set).toEqual({ $current_url: clean });
    expect(result?.$set_once).toEqual({ $initial_referrer: clean });
    expect(result?.properties?.$set).toEqual({ $current_url: clean });
    expect(result?.properties?.$set_once).toEqual({
      $initial_current_url: clean,
    });
  });

  test("a `url` property on a product event is not the deep link and is left alone", () => {
    const result = sanitizePosthogEvent(
      event("product_saved", {
        product_id: "p-1",
        url: "https://shop.example/p?code=SUMMER",
      }),
    );
    expect(result?.properties?.url).toBe("https://shop.example/p?code=SUMMER");
  });

  test("everything else on the event is untouched", () => {
    const timestamp = new Date("2026-10-07T00:00:00Z");
    const input: CaptureEvent = {
      uuid: "u-1",
      event: "look_generated",
      timestamp,
      properties: { app: "mila-mobile", vibe: "minimal", count: 3, flag: true },
    };
    const result = sanitizePosthogEvent(input);
    expect(result?.uuid).toBe("u-1");
    expect(result?.event).toBe("look_generated");
    expect(result?.timestamp).toBe(timestamp);
    expect(result?.properties).toEqual({
      app: "mila-mobile",
      vibe: "minimal",
      count: 3,
      flag: true,
    });
  });

  test("does not mutate the event it was given", () => {
    const input = event("Application Opened", { url: leaky });
    sanitizePosthogEvent(input);
    expect(input.properties?.url).toBe(leaky);
  });

  test("a null event stays null", () => {
    expect(sanitizePosthogEvent(null)).toBeNull();
  });

  test("fails closed: an event it cannot read is dropped, not sent", () => {
    const hostile = {
      uuid: "u-2",
      event: "Application Opened",
      get properties(): CaptureEvent["properties"] {
        throw new Error("boom");
      },
    } satisfies CaptureEvent;
    expect(sanitizePosthogEvent(hostile)).toBeNull();
  });
});

describe("the PostHog client is constructed with the hook", () => {
  const originalKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const globalStore = globalThis as { __milaPosthog?: unknown };

  afterEach(() => {
    if (originalKey === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
    else process.env.EXPO_PUBLIC_POSTHOG_KEY = originalKey;
    delete globalStore.__milaPosthog;
    jest.resetModules();
    jest.dontMock("posthog-react-native");
  });

  type Options = {
    before_send?: (e: CaptureEvent | null) => CaptureEvent | null;
  };

  function loadWithKey() {
    process.env.EXPO_PUBLIC_POSTHOG_KEY = "phc_test_key";
    delete globalStore.__milaPosthog;
    const screen = jest.fn();
    const Ctor = jest.fn().mockImplementation(() => ({
      register: jest.fn(),
      capture: jest.fn(),
      identify: jest.fn(),
      reset: jest.fn(),
      screen,
    }));
    jest.resetModules();
    jest.doMock("posthog-react-native", () => ({
      __esModule: true,
      default: Ctor,
    }));
    const mod =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/services/posthog") as typeof import("@/services/posthog");
    return { mod, Ctor, screen };
  }

  test("new PostHog(...) receives a before_send that sanitizes the deep link", () => {
    const { Ctor } = loadWithKey();
    expect(Ctor).toHaveBeenCalledTimes(1);
    const options = Ctor.mock.calls[0]?.[1] as Options;
    expect(typeof options.before_send).toBe("function");
    const result = options.before_send?.(
      event("Application Opened", {
        url: "mila://auth/callback#access_token=AT-secret",
      }),
    );
    expect(result?.properties?.url).toBe("mila://auth/callback");
  });

  test("captureScreen sends the pathname without query or fragment", () => {
    const { mod, screen } = loadWithKey();
    mod.captureScreen("/reset-password?token_hash=th-secret#x");
    expect(screen).toHaveBeenCalledWith("/reset-password");
  });
});

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
  test("a callback URL carrying the session in the fragment keeps only origin and path", () => {
    const url =
      "https://mila.app/auth/callback#access_token=AT-secret&refresh_token=RT-secret&expires_in=3600&token_type=bearer&type=recovery";
    const clean = sanitizeUrl(url);
    expect(clean).toBe("https://mila.app/auth/callback");
    expect(clean).not.toContain("AT-secret");
    expect(clean).not.toContain("RT-secret");
  });

  test("any fragment is dropped, not just token-shaped ones", () => {
    expect(sanitizeUrl("https://mila.app/closet?tab=outfits#section-2")).toBe(
      "https://mila.app/closet?tab=outfits",
    );
  });

  test("the whole query and fragment are dropped on any /auth/* path, even allowlisted params", () => {
    expect(
      sanitizeUrl(
        "https://mila.app/auth/callback?code=pkce-secret&utm_source=email#x=1",
      ),
    ).toBe("https://mila.app/auth/callback");
    expect(
      sanitizeUrl(
        "https://mila.app/auth/confirm?token_hash=th-secret&type=signup",
      ),
    ).toBe("https://mila.app/auth/confirm");
    expect(sanitizeUrl("/auth/reset-password?tab=x")).toBe(
      "/auth/reset-password",
    );
    expect(
      sanitizeUrl("mila://auth/callback?code=S&utm_source=x#access_token=AT"),
    ).toBe("mila://auth/callback");
    expect(sanitizeUrl("mila://auth?code=S")).toBe("mila://auth");
  });

  test("a token in the path of /auth/confirm/<token> is replaced", () => {
    const token = "AbCdEf0123456789xyzQWERTY";
    const clean = sanitizeUrl(`https://mila.app/auth/confirm/${token}?x=1`);
    expect(clean).toBe("https://mila.app/auth/confirm/:token");
    expect(clean).not.toContain(token);
  });

  test("hex and JWT-shaped path segments are replaced; short ids are kept", () => {
    expect(sanitizeUrl("https://mila.app/r/0123456789abcdef0123/x")).toBe(
      "https://mila.app/r/:token/x",
    );
    expect(
      sanitizeUrl(
        "https://mila.app/s/eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc",
      ),
    ).toBe("https://mila.app/s/:token");
    expect(sanitizeUrl("https://mila.app/look/8c1f")).toBe(
      "https://mila.app/look/8c1f",
    );
  });

  test("an encoded # inside the path cannot carry a fragment through", () => {
    expect(
      sanitizeUrl("https://mila.app/callback%23access_token=SECRET"),
    ).not.toContain("SECRET");
  });

  test("UTM and other allowlisted params are kept", () => {
    const url =
      "https://mila.app/closet?utm_source=email&utm_medium=cpc&utm_campaign=spring-sale&utm_term=boots&utm_content=a1&ref=friend&page=2&tab=outfits&section=top&view=grid&sort=new";
    expect(sanitizeUrl(url)).toBe(url);
  });

  test("anything outside the allowlist is dropped, including q and free text", () => {
    expect(
      sanitizeUrl(
        "https://mila.app/search?q=nicole%40example.com&utm_source=x&look=1",
      ),
    ).toBe("https://mila.app/search?utm_source=x");
    expect(sanitizeUrl("https://mila.app/x?SECRET")).toBe("https://mila.app/x");
  });

  test("otp, jwt, key and the old denylist params are all dropped", () => {
    expect(
      sanitizeUrl(
        "https://mila.app/x?otp=S1&jwt=S2&key=S3&code=S4&token_hash=S5&redirect=S6&tab=a",
      ),
    ).toBe("https://mila.app/x?tab=a");
  });

  test("names are matched case-insensitively", () => {
    expect(sanitizeUrl("https://mila.app/x?UTM_Source=e&CODE=b")).toBe(
      "https://mila.app/x?utm_source=e",
    );
  });

  test("double-encoded names cannot smuggle a key past the filter", () => {
    expect(sanitizeUrl("https://mila.app/x?%2563ode=SECRET&tab=a")).toBe(
      "https://mila.app/x?tab=a",
    );
    expect(sanitizeUrl("https://mila.app/x?%2574ab=a")).toBe(
      "https://mila.app/x?tab=a",
    );
  });

  test("a trailing space or + in the name does not hide or disguise a param", () => {
    for (const q of [
      "code%20=SECRET",
      "code+=SECRET",
      "%20code=SECRET",
      "code%2B=SECRET",
    ]) {
      expect(sanitizeUrl(`https://mila.app/x?${q}&tab=a`)).toBe(
        "https://mila.app/x?tab=a",
      );
    }
  });

  test("; is a separator: a param after it is judged on its own", () => {
    expect(sanitizeUrl("https://mila.app/x?a=1;code=SECRET")).toBe(
      "https://mila.app/x",
    );
    expect(sanitizeUrl("https://mila.app/x?tab=a;code=SECRET")).toBe(
      "https://mila.app/x?tab=a",
    );
    expect(sanitizeUrl("https://mila.app/x?code=SECRET;tab=a")).toBe(
      "https://mila.app/x?tab=a",
    );
  });

  test("a token nested inside a kept param's value does not survive", () => {
    for (const q of [
      "ref=%2Fauth%3Fcode%3DSECRET",
      "tab=a%26code%3DSECRET",
      "ref=https%3A%2F%2Fx.test%2F%3Fcode%3DSECRET",
      "page=SECRET0123456789abcdefXYZ",
      "view=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc",
      "ref=%2525%2563ode%253DSECRET",
    ]) {
      const clean = sanitizeUrl(`https://mila.app/x?${q}&utm_source=ok`);
      expect(clean).not.toContain("SECRET");
      expect(clean).not.toContain("eyJ");
      expect(clean).toContain("utm_source=ok");
    }
  });

  test("embedded credentials (userinfo) are dropped", () => {
    expect(sanitizeUrl("https://user:pw@mila.app/x?code=1")).toBe(
      "https://mila.app/x",
    );
  });

  test("a custom-scheme deep link is sanitized the same way", () => {
    expect(
      sanitizeUrl("mila://auth/callback#access_token=AT&refresh_token=RT"),
    ).toBe("mila://auth/callback");
    expect(sanitizeUrl("mila://look/8c1f?utm_source=push&code=S")).toBe(
      "mila://look/8c1f?utm_source=push",
    );
  });

  test("a bare path (as in $pathname) is sanitized, not rejected", () => {
    expect(sanitizeUrl("/auth/callback?code=1#a=b")).toBe("/auth/callback");
    expect(sanitizeUrl("/closet")).toBe("/closet");
    expect(sanitizeUrl("/auth/confirm/AbCdEf0123456789xyzQWERTY")).toBe(
      "/auth/confirm/:token",
    );
  });

  test("unparseable input becomes a fixed placeholder, never the raw string", () => {
    expect(sanitizeUrl("not a url")).toBe("[unparseable-url]");
    expect(sanitizeUrl("")).toBe("[unparseable-url]");
    expect(sanitizeUrl("access_token=leaky")).toBe("[unparseable-url]");
    expect(sanitizeUrl("mailto:nicole@example.com")).toBe("[unparseable-url]");
  });

  test("sanitizing twice changes nothing", () => {
    for (const url of [
      "https://mila.app/auth/callback?code=1&keep=2#access_token=3",
      "https://mila.app/x?utm_source=a&code=1&tab=b",
    ]) {
      const once = sanitizeUrl(url);
      expect(sanitizeUrl(once)).toBe(once);
    }
  });

  test("an Expo dev-client deep link keeps host, port and path", () => {
    expect(
      sanitizeUrl("exp://192.168.1.5:8081/--/auth/callback#access_token=AT"),
    ).toBe("exp://192.168.1.5:8081/--/auth/callback");
  });

  test("mila://<token> (token in the host) is replaced", () => {
    expect(sanitizeUrl("mila://AbCdEf0123456789xyzQWERTY")).toBe(
      "mila://:token",
    );
  });
});

describe("sanitizePosthogEvent: the before_send hook scrubs every event", () => {
  const leaky =
    "mila://closet?code=pkce-secret&tab=outfits#access_token=AT-secret";
  const clean = "mila://closet?tab=outfits";

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
        $pathname: "/closet?code=1",
        $initial_current_url: leaky,
        $initial_referrer: leaky,
      }),
    );
    expect(result?.properties).toEqual({
      $current_url: clean,
      $referrer: clean,
      $pathname: "/closet",
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
    enableSessionReplay?: boolean;
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

  test("session replay is explicitly off (its payloads are not scrubbed)", () => {
    const { Ctor } = loadWithKey();
    const options = Ctor.mock.calls[0]?.[1] as Options;
    expect(options.enableSessionReplay).toBe(false);
  });

  test("captureScreen sends the pathname without query or fragment", () => {
    const { mod, screen } = loadWithKey();
    mod.captureScreen("/reset-password?token_hash=th-secret#x");
    expect(screen).toHaveBeenCalledWith("/reset-password");
  });
});

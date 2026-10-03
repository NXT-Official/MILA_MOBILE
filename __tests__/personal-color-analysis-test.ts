/**
 * The same scaffolding as `api-client-test.ts`: the supabase client and env are
 * mocked because this module chain reads both at import time.
 */
jest.mock("../src/services/supabase/client", () => ({
  supabase: { auth: { getSession: jest.fn(), refreshSession: jest.fn() } },
}));

jest.mock("../src/constants/env", () => ({
  env: {
    API_BASE_URL: "https://api.test",
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_PUBLISHABLE_KEY: "publishable",
    HCAPTCHA_SITEKEY: "sitekey",
  },
}));

import { analyzePersonalColor } from "@/services/api/analysis";
import { supabase } from "@/services/supabase/client";
import type { PersonalColorAnalysisResult } from "@/types/models";

const mockGetSession = supabase.auth.getSession as unknown as jest.Mock;
const mockRefreshSession = supabase.auth.refreshSession as unknown as jest.Mock;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: { access_token: "token-1" } } });
  mockRefreshSession.mockResolvedValue({ data: { session: null } });
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("analyzePersonalColor", () => {
  it("posts the base64 payload to the personal-color route", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { success: false, error: "ANALYSIS_GATEWAY_FAILURE" }),
    );

    await analyzePersonalColor({ imageBase64: "aGVsbG8=" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/analysis/personal-color");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-1");
    expect(init.body).toBe(JSON.stringify({ imageBase64: "aGVsbG8=" }));
  });

  it("passes the 200 union through — a failed read is data, not a throw", async () => {
    const failure: PersonalColorAnalysisResult = {
      success: false,
      error: "ANALYSIS_RATE_LIMITED",
    };
    fetchMock.mockResolvedValue(jsonResponse(200, failure));

    await expect(analyzePersonalColor({ imageBase64: "x" })).resolves.toEqual(failure);
  });

  it("passes a successful read through with its profile and telemetry", async () => {
    const success = {
      success: true,
      profile: { season: "Spring", subSeason: "Spring Light" },
      telemetry: { forcedDiagnostic: false },
    };
    fetchMock.mockResolvedValue(jsonResponse(200, success));

    await expect(analyzePersonalColor({ imageBase64: "x" })).resolves.toEqual(success);
  });

  it("still throws for the shared HTTP taxonomy — a 401 is a session problem, not a read problem", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: { code: "UNAUTHENTICATED", message: "no token" } }),
    );

    await expect(analyzePersonalColor({ imageBase64: "x" })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
});

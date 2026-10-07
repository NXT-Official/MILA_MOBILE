import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { DailyLook } from "@/types/look";

/**
 * The three paid calls on Home, as hooks. Each sends the key its press minted,
 * never retries (a retried paid call is a double charge), and on settle
 * re-reads both the balance and her generation jobs by their explicit keys, so
 * a result that finished while the screen was away is picked up at once.
 */
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } }) => unknown) =>
    select({ session: { user: { id: "member" } } }),
}));
jest.mock("../src/hooks/use-profile", () => ({
  useProfile: () => ({
    data: {
      body_type: "Hourglass",
      color_season: "Autumn",
      color_season_base: "Autumn",
      default_location: null,
    },
  }),
}));
jest.mock("../src/services/supabase/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../src/services/weather", () => ({ hubById: () => null }));
jest.mock("../src/services/supabase/generation-jobs", () => ({
  fetchLatestGenerationJob: jest.fn(),
  fetchGenerationImage: jest.fn(),
}));
jest.mock("../src/services/api/client", () => ({ api: { post: jest.fn() }, TIMEOUTS: {} }));
jest.mock("../src/services/api/look", () => ({
  ...jest.requireActual("../src/services/api/look"),
  generateDailyLook: jest.fn(),
  generateStyleSheetPreview: jest.fn(),
  generatePhotoPreview: jest.fn(),
}));

import { useGenerateLook } from "@/features/dashboard/hooks/use-generate-look";
import { generationJobsKey } from "@/features/dashboard/hooks/use-generation-jobs";
import { usePhotoPreview } from "@/features/dashboard/hooks/use-photo-preview";
import { useStyleSheet } from "@/features/dashboard/hooks/use-style-sheet";
import {
  generateDailyLook,
  generatePhotoPreview,
  generateStyleSheetPreview,
} from "@/services/api/look";
import { trackEvent } from "@/services/supabase/analytics";

const KEY = "0b9d6a52-3c7e-4f8a-9d61-2f4e8c1a7b30";
const LOOK: DailyLook = {
  outfit: { headline: "Linen and light", description: "A light layer.", styling_notes: "Roll the cuff." },
  hair: { style: "Loose waves", execution_tip: "Air dry." },
  makeup: null,
  vibe_alignment_score: 8,
};
const WEATHER = {
  label: "24°C Sunny",
  location: "Manila",
  country: "PH",
  icon: "sun",
  tempF: 75,
  tempC: 24,
  condition: "Sunny",
} as const;

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  // The app's own mutation default: a paid call is never retried. No gc timer,
  // so nothing keeps the test process alive once the run is over.
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
});

afterEach(() => queryClient.clear());

const invalidatedKeys = (spy: jest.SpyInstance) =>
  spy.mock.calls.map(([filters]) => JSON.stringify((filters as { queryKey: unknown }).queryKey));

describe("useGenerateLook", () => {
  it("sends the press's key, and re-reads the balance and her jobs when it settles", async () => {
    jest.mocked(generateDailyLook).mockResolvedValue({ ...LOOK, jobId: "job-1" });
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = await renderHook(() => useGenerateLook(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ weather: WEATHER, vibe: "Everyday Casual", clientRequestId: KEY });
    });

    expect(generateDailyLook).toHaveBeenCalledWith(
      expect.objectContaining({ bodyType: "Hourglass", vibe: "Everyday Casual" }),
      KEY,
    );
    expect(invalidatedKeys(invalidate)).toEqual(
      expect.arrayContaining([
        JSON.stringify(["credits", "member"]),
        JSON.stringify(generationJobsKey("member")),
      ]),
    );
    expect(trackEvent).toHaveBeenCalledWith("member", "look_generated", { vibe: "Everyday Casual" });
  });

  it("does not count a look it was only told is still running", async () => {
    jest.mocked(generateDailyLook).mockResolvedValue({ status: "running", jobId: "job-1" });
    const { result } = await renderHook(() => useGenerateLook(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ weather: WEATHER, vibe: "Everyday Casual", clientRequestId: KEY });
    });

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("never retries a failed paid call, and still re-reads her jobs", async () => {
    jest.mocked(generateDailyLook).mockRejectedValue(new Error("network"));
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = await renderHook(() => useGenerateLook(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ weather: WEATHER, vibe: "Everyday Casual", clientRequestId: KEY })
        .catch(() => undefined);
    });

    expect(generateDailyLook).toHaveBeenCalledTimes(1);
    expect(invalidatedKeys(invalidate)).toContain(JSON.stringify(generationJobsKey("member")));
  });
});

describe.each([
  ["useStyleSheet", useStyleSheet, generateStyleSheetPreview],
  ["usePhotoPreview", usePhotoPreview, generatePhotoPreview],
] as const)("%s", (_name, useVisual, request) => {
  it("sends the look with the press's key, and re-reads her jobs when it settles", async () => {
    jest.mocked(request).mockResolvedValue({ imageDataUri: null, mode: "unavailable", reason: "x" });
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = await renderHook(() => useVisual(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ outfit: LOOK, clientRequestId: KEY });
    });

    expect(request).toHaveBeenCalledWith(LOOK, KEY);
    expect(invalidatedKeys(invalidate)).toEqual(
      expect.arrayContaining([
        JSON.stringify(["credits", "member"]),
        JSON.stringify(generationJobsKey("member")),
      ]),
    );
  });
});

describe("a paid call is never retried by the hook itself", () => {
  // Whatever the client's default, each paid hook says retry: false on its own.
  type PaidHook = () => { mutateAsync: (variables: never) => Promise<unknown> };
  it.each<[string, PaidHook, jest.Mock, unknown]>([
    [
      "useGenerateLook",
      useGenerateLook,
      jest.mocked(generateDailyLook),
      { weather: WEATHER, vibe: "Everyday Casual", clientRequestId: KEY },
    ],
    ["useStyleSheet", useStyleSheet, jest.mocked(generateStyleSheetPreview), { outfit: LOOK, clientRequestId: KEY }],
    ["usePhotoPreview", usePhotoPreview, jest.mocked(generatePhotoPreview), { outfit: LOOK, clientRequestId: KEY }],
  ])("%s", async (_name, useHook, request, variables) => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: 3, retryDelay: 0, gcTime: Infinity } },
    });
    request.mockRejectedValue(new Error("server error"));
    const { result } = await renderHook(() => useHook(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(variables as never).catch(() => undefined);
    });

    expect(request).toHaveBeenCalledTimes(1);
  });
});

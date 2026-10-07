jest.mock("../src/services/api/client", () => ({
  api: { post: jest.fn() },
  TIMEOUTS: { generateLook: 240_000, lookVisual: 300_000 },
}));

import { api } from "@/services/api/client";
import {
  generateDailyLook,
  generatePhotoPreview,
  generateStyleSheetPreview,
  isGenerationRunning,
  type GenerateLookInput,
} from "@/services/api/look";
import type { DailyLook } from "@/types/look";

/**
 * The three paid look calls carry the press's idempotency key. The server
 * charges a key once: a repeat replays the stored result, and while the job is
 * still running it answers `{ status: "running", jobId }` for the app to follow.
 * Without a key (old builds) the request is exactly what it was.
 */

const post = jest.mocked(api.post);

const INPUT: GenerateLookInput = {
  bodyType: "Hourglass",
  colorSeason: "Autumn",
  weather: "24°C Sunny (in Manila)",
  vibe: "Everyday Casual",
};

const LOOK: DailyLook = {
  outfit: { headline: "Linen and light", description: "A light layer.", styling_notes: "Roll the cuff." },
  hair: { style: "Loose waves", execution_tip: "Air dry." },
  makeup: null,
  vibe_alignment_score: 8,
};

const KEY = "0b9d6a52-3c7e-4f8a-9d61-2f4e8c1a7b30";

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({});
});

it("sends the key with the look request", async () => {
  await generateDailyLook(INPUT, KEY);
  expect(post).toHaveBeenCalledWith(
    "/look/generate",
    { ...INPUT, clientRequestId: KEY },
    { timeoutMs: 240_000 },
  );
});

it("sends the key with both visuals", async () => {
  await generateStyleSheetPreview(LOOK, KEY);
  expect(post).toHaveBeenLastCalledWith(
    "/look/style-sheet",
    { outfit: LOOK, clientRequestId: KEY },
    { timeoutMs: 300_000 },
  );

  await generatePhotoPreview(LOOK, KEY);
  expect(post).toHaveBeenLastCalledWith(
    "/look/photo-preview",
    { outfit: LOOK, clientRequestId: KEY },
    { timeoutMs: 300_000 },
  );
});

it("sends exactly today's body when there is no key", async () => {
  await generateDailyLook(INPUT);
  expect(post).toHaveBeenLastCalledWith("/look/generate", INPUT, { timeoutMs: 240_000 });

  await generateStyleSheetPreview(LOOK);
  expect(post).toHaveBeenLastCalledWith("/look/style-sheet", { outfit: LOOK }, { timeoutMs: 300_000 });
});

it("hands back the server's running answer for the caller to follow", async () => {
  post.mockResolvedValueOnce({ status: "running", jobId: "job-1" });
  const answer = await generateDailyLook(INPUT, KEY);

  expect(isGenerationRunning(answer)).toBe(true);
  expect(isGenerationRunning(LOOK)).toBe(false);
  expect(isGenerationRunning({ imageDataUri: null, mode: "unavailable", reason: "x" })).toBe(false);
  expect(isGenerationRunning(null)).toBe(false);
  expect(isGenerationRunning({ status: "running" })).toBe(false);
});

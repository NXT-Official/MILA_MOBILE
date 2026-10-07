jest.mock("@/services/posthog", () => ({
  capturePhEvent: jest.fn(),
  identifyPhUser: jest.fn(),
}));
jest.mock("../src/services/supabase/client", () => ({
  supabase: { from: jest.fn() },
}));

import { capturePhEvent, identifyPhUser } from "@/services/posthog";
import { trackEvent } from "@/services/supabase/analytics";
import { supabase } from "../src/services/supabase/client";

const from = jest.mocked(supabase.from);
const capture = jest.mocked(capturePhEvent);
const identify = jest.mocked(identifyPhUser);

beforeEach(() => {
  jest.clearAllMocks();
});

test("trackEvent mirrors to PostHog before the database insert", async () => {
  const insert = jest.fn().mockResolvedValue({ error: null });
  from.mockReturnValue({ insert } as never);

  await trackEvent("member-1", "look_generated", { vibe: "minimal" });

  expect(identify).toHaveBeenCalledWith("member-1");
  expect(capture).toHaveBeenCalledWith("look_generated", { vibe: "minimal", source: "mobile" });
  expect(from).toHaveBeenCalledWith("analytics_events");
  expect(insert).toHaveBeenCalledWith({
    user_id: "member-1",
    event_name: "look_generated",
    source: "mobile",
    properties: { vibe: "minimal" },
  });
});

test("a failed insert logs and never throws — the mirror already fired", async () => {
  const insert = jest.fn().mockResolvedValue({ error: { message: "nope" } });
  from.mockReturnValue({ insert } as never);
  const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  await expect(trackEvent("member-1", "purchase_started")).resolves.toBeUndefined();

  expect(capture).toHaveBeenCalledWith("purchase_started", { source: "mobile" });
  expect(errSpy).toHaveBeenCalled();
  errSpy.mockRestore();
});

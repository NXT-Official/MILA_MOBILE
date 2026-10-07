import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } }) => unknown) =>
    select({ session: { user: { id: "member" } } }),
}));
jest.mock("../src/services/supabase/profile-extras", () => ({
  fetchProfileExtras: jest.fn(),
  saveProfileExtras: jest.fn(),
}));

import { useProfileExtras, useSaveProfileExtras } from "@/hooks/use-profile-extras";
import { fetchProfileExtras, saveProfileExtras } from "@/services/supabase/profile-extras";

const fetchExtras = jest.mocked(fetchProfileExtras);
const save = jest.mocked(saveProfileExtras);

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => queryClient.clear());

it("reads her extras and says whether the columns exist", async () => {
  fetchExtras.mockResolvedValue({
    status: "ok",
    extras: { hairColor: "Red", lastCheckInAt: null, foundingBodyReadAt: null },
  });
  const { result } = await renderHook(() => useProfileExtras(), { wrapper });
  await waitFor(() => expect(result.current.available).toBe(true));
  expect(result.current.extras?.hairColor).toBe("Red");
  expect(fetchExtras).toHaveBeenCalledWith("member");
});

it("reports unavailable while the migration is missing", async () => {
  fetchExtras.mockResolvedValue({ status: "unavailable" });
  const { result } = await renderHook(() => useProfileExtras(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.available).toBe(false);
  expect(result.current.extras).toBeNull();
});

it("saves, then refreshes the extras key explicitly", async () => {
  fetchExtras.mockResolvedValue({
    status: "ok",
    extras: { hairColor: null, lastCheckInAt: null, foundingBodyReadAt: null },
  });
  save.mockResolvedValue("saved");
  const spy = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = await renderHook(() => useSaveProfileExtras(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({ hair_color: "Auburn" });
  });

  expect(save).toHaveBeenCalledWith("member", { hair_color: "Auburn" });
  expect(spy).toHaveBeenCalledWith({ queryKey: ["profile-extras", "member"] });
});

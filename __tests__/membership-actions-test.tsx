import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

jest.mock("../src/components/ui/Sheet", () => ({
  Sheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null,
}));
jest.mock("../src/hooks/use-network-status", () => ({ useNetworkStatus: jest.fn(() => ({ online: true })) }));
jest.mock("../src/services/api/billing", () => ({ cancelMembership: jest.fn(), resumeMembership: jest.fn() }));
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } }) => unknown) => select({ session: { user: { id: "member" } } }),
}));

import { MembershipActions } from "@/features/membership/components/MembershipActions";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { resolveMembership } from "@/lib/subscription-status";
import { cancelMembership, resumeMembership } from "@/services/api/billing";

const cancel = jest.mocked(cancelMembership);
const resume = jest.mocked(resumeMembership);
const network = jest.mocked(useNetworkStatus);
const row = {
  status: "active",
  cancel_at_period_end: false,
  current_period_end: "2026-11-01T00:00:00Z",
  paddle_subscription_id: null,
};
const clients: QueryClient[] = [];

async function mount(cancelled = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  clients.push(queryClient);
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <MembershipActions membership={resolveMembership({ ...row, cancel_at_period_end: cancelled })} />
    </QueryClientProvider>,
  );
  return { screen, invalidate };
}

beforeEach(() => {
  jest.clearAllMocks();
  network.mockReturnValue({ online: true });
  cancel.mockResolvedValue({ success: true, endsAt: row.current_period_end });
  resume.mockResolvedValue({ success: true, renewsAt: row.current_period_end });
});

afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

test("opening cancellation explains retained access and makes no billing request", async () => {
  const { screen } = await mount();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel membership" }));
  expect(screen.getByText(/Your access continues until/)).toBeTruthy();
  expect(cancel).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Not now" }));
  expect(cancel).not.toHaveBeenCalled();
});

test("confirmed cancellation calls server once then refreshes member caches by key", async () => {
  const { screen, invalidate } = await mount();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel membership" }));
  await fireEvent.press(screen.getByRole("button", { name: "Confirm cancellation" }));
  await waitFor(() => expect(screen.getByText(/Cancellation scheduled/)).toBeTruthy());
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(resume).not.toHaveBeenCalled();
  expect(invalidate.mock.calls).toEqual([
    [{ queryKey: ["my-subscription", "member"] }],
    [{ queryKey: ["credits", "member"] }],
    [{ queryKey: ["profile", "member"] }],
  ]);
});

test("failed cancellation stays in confirmation with manual retry, no auto-retry", async () => {
  cancel.mockRejectedValueOnce(new Error("upstream failure"));
  const { screen, invalidate } = await mount();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel membership" }));
  await fireEvent.press(screen.getByRole("button", { name: "Confirm cancellation" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy());
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(invalidate).not.toHaveBeenCalled();
  expect(screen.queryByText(/Cancellation scheduled/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(cancel).toHaveBeenCalledTimes(2));
});

test("scheduled cancellation offers resume and waits for confirmation", async () => {
  const { screen } = await mount(true);
  await fireEvent.press(screen.getByRole("button", { name: "Resume membership" }));
  expect(resume).not.toHaveBeenCalled();
  await fireEvent.press(screen.getAllByRole("button", { name: "Resume membership" })[1]);
  // The date is the one the endpoint returned, not one the app worked out.
  await waitFor(() =>
    expect(screen.getByText("Your membership will renew on November 1, 2026.")).toBeTruthy(),
  );
  expect(resume).toHaveBeenCalledTimes(1);
  expect(cancel).not.toHaveBeenCalled();
});

test("offline membership management cannot start a billing request", async () => {
  network.mockReturnValue({ online: false });
  const { screen } = await mount();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel membership" }));
  expect(screen.queryByRole("button", { name: "Confirm cancellation" })).toBeNull();
  expect(screen.getByText("Connect to the internet to manage your membership.")).toBeTruthy();
  expect(cancel).not.toHaveBeenCalled();
});

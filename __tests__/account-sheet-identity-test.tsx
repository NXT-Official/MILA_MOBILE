import { render } from "@testing-library/react-native";

/**
 * The account sheet names the member by what she told Mila, never by what she
 * signed in with. An email's local part is neither her name nor her handle, and
 * putting it in the sheet's header ("@jane.doe") hands her own sign-in address
 * back as if it were public identity.
 */
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../src/components/ui/Sheet", () => require("../src/test-utils/sheet-mock"));
jest.mock("../src/components/ui/CreditsMeter", () => ({ CreditsMeter: () => null }));

const mockState = {
  profile: undefined as { full_name: string | null } | undefined,
};

jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { email: string } } }) => unknown) =>
    select({ session: { user: { email: "jane.doe@example.test" } } }),
}));
jest.mock("../src/hooks/use-profile", () => ({
  useProfile: () => ({ data: mockState.profile }),
}));
jest.mock("../src/hooks/use-my-subscription", () => ({
  useMySubscription: () => ({ data: null }),
}));
jest.mock("../src/hooks/use-subscription-plans", () => ({
  useSubscriptionPlans: () => ({ data: [] }),
}));
jest.mock("../src/hooks/use-credits", () => ({
  useCredits: () => ({ data: null, isPending: false }),
  useCreditBalance: () => 0,
}));

import { AccountSheet } from "@/components/layout/AccountSheet";

beforeEach(() => {
  mockState.profile = undefined;
});

test("her own name is shown when she has one", async () => {
  mockState.profile = { full_name: "Jane Doe" };
  const screen = await render(<AccountSheet visible onClose={jest.fn()} />);

  expect(screen.getByText("Jane Doe")).toBeTruthy();
});

test("without a name she is a member, not the front of her email address", async () => {
  mockState.profile = { full_name: "  " };
  const screen = await render(<AccountSheet visible onClose={jest.fn()} />);

  expect(screen.getByText("Member")).toBeTruthy();
  expect(screen.queryByText(/jane\.doe/i)).toBeNull();
});

test("no handle is built from her sign-in address", async () => {
  mockState.profile = { full_name: "Jane Doe" };
  const screen = await render(<AccountSheet visible onClose={jest.fn()} />);

  expect(screen.queryByText(/^@/)).toBeNull();
  expect(screen.queryByText(/jane\.doe/i)).toBeNull();
});

test("before her profile loads the sheet does not fall back to her email", async () => {
  mockState.profile = undefined;
  const screen = await render(<AccountSheet visible onClose={jest.fn()} />);

  expect(screen.getByText("Member")).toBeTruthy();
  expect(screen.queryByText(/jane\.doe/i)).toBeNull();
});

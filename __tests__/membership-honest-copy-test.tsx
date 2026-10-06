import { render } from "@testing-library/react-native";

/**
 * Payments are not live yet, so nothing on the membership screen or in the
 * out-of-credits sheet may read as an offer she can act on. The plan cards
 * have no purchase control, and a headline that says "Choose" over them is a
 * dead end that looks like a bug.
 *
 * The data hooks are stubs whose state the tests choose; the screen, the plan
 * cards and the paywall sheet's own markup are real.
 */
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("../src/components/layout/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../src/components/ui/CreditsMeter", () => ({ CreditsMeter: () => null }));
jest.mock("../src/features/membership/components/MembershipActions", () => ({
  MembershipActions: () => null,
}));
jest.mock("../src/components/ui/Sheet", () => require("../src/test-utils/sheet-mock"));

const mockState = {
  subscription: {
    data: null as unknown,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  },
};

const mockPlan = {
  id: "plan-1",
  slug: "atelier",
  title: "Atelier",
  description: "Everything Mila does.",
  features: ["Daily looks"],
  price_amount: 49900,
  currency: "PHP",
  billing_interval: "monthly",
  credits_included: 30,
  is_featured: true,
};

jest.mock("../src/hooks/use-my-subscription", () => ({
  useMySubscription: () => mockState.subscription,
}));
jest.mock("../src/hooks/use-credits", () => ({
  useCredits: () => ({ data: null, isPending: false }),
  useCreditBalance: () => 0,
}));
jest.mock("../src/hooks/use-subscription-plans", () => ({
  ...jest.requireActual("../src/lib/subscription-plans"),
  useSubscriptionPlans: () => ({
    data: [mockPlan],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

import { PaywallSheet } from "@/components/feedback/PaywallSheet";
import { MembershipScreen } from "@/features/membership/MembershipScreen";

beforeEach(() => {
  mockState.subscription = {
    data: null,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  };
});

describe("MembershipScreen", () => {
  test("a member without a plan is told memberships are not open yet", async () => {
    const screen = await render(<MembershipScreen />);

    expect(
      screen.getByText("Memberships open soon. Your stylist is getting ready."),
    ).toBeTruthy();
  });

  test("it never invites a choice the plan cards cannot honour", async () => {
    const screen = await render(<MembershipScreen />);

    expect(screen.queryByText(/choose your atelier access/i)).toBeNull();
    expect(screen.queryByText(/select the membership/i)).toBeNull();
    // Plans are shown for information; the only control left is Back.
    const labels = screen.queryAllByRole("button").map((button) => button.props.accessibilityLabel);
    expect(labels).toEqual(["Back"]);
  });

  test("a member who already has a plan is not told memberships are not open", async () => {
    mockState.subscription = {
      data: {
        plan_id: mockPlan.id,
        status: "active",
        cancel_at_period_end: false,
        current_period_end: "2026-11-01T00:00:00Z",
        paddle_subscription_id: "sub_1",
      },
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    };
    const screen = await render(<MembershipScreen />);

    expect(screen.queryByText(/open soon/i)).toBeNull();
    expect(screen.getByText("Your membership and what each plan includes.")).toBeTruthy();
  });

  test("while her membership is still loading it makes no claim about it", async () => {
    mockState.subscription = {
      data: undefined,
      isPending: true,
      isError: false,
      refetch: jest.fn(),
    };
    const screen = await render(<MembershipScreen />);

    expect(screen.queryByText(/open soon/i)).toBeNull();
    expect(screen.getByText("What each plan includes.")).toBeTruthy();
  });
});

describe("PaywallSheet", () => {
  test("out of credits does not promise a purchase", async () => {
    const screen = await render(<PaywallSheet visible onClose={jest.fn()} />);

    expect(screen.getByText("You're out of credits")).toBeTruthy();
    expect(screen.getByText(/Memberships open soon/)).toBeTruthy();
    expect(screen.queryByText(/choose the one that fits/i)).toBeNull();
    expect(screen.queryByText(/refresh daily with a membership/i)).toBeNull();
  });
});

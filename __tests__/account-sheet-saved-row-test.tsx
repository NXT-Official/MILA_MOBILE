import { fireEvent, render } from "@testing-library/react-native";

/**
 * Saved pieces are reached from the account sheet, next to the outfit archive:
 * the two places she keeps things Mila made for her sit together.
 */
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../src/components/ui/Sheet", () => require("../src/test-utils/sheet-mock"));
jest.mock("../src/components/ui/CreditsMeter", () => ({ CreditsMeter: () => null }));
jest.mock("../src/hooks/use-profile", () => ({ useProfile: () => ({ data: undefined }) }));
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

import { router } from "expo-router";

import { AccountSheet } from "@/components/layout/AccountSheet";

test("a Saved pieces row sits right after Outfit archive and opens the saved screen", async () => {
  const onClose = jest.fn();
  const s = await render(<AccountSheet visible onClose={onClose} />);

  const labels = s.getAllByRole("button").map((node) => node.props.accessibilityLabel as string);
  const archive = labels.findIndex((label) => label.startsWith("Outfit archive"));
  expect(labels[archive + 1]).toMatch(/^Saved pieces/);

  await fireEvent.press(s.getByRole("button", { name: /^Saved pieces/ }));
  expect(onClose).toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith("/saved");
});

test("every row that was there before is still there", async () => {
  const s = await render(<AccountSheet visible onClose={jest.fn()} />);
  for (const name of [/^Membership/, /^Colour dossier/, /^Outfit archive/, /^Settings/]) {
    expect(s.getByRole("button", { name })).toBeTruthy();
  }
});

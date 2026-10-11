import { fireEvent, render } from "@testing-library/react-native";

/**
 * Sign out lives where members look for it: under the avatar. The avatar opens
 * the account sheet, and the sheet's content is taller than its detent, so the
 * control sits in the title row, on screen the moment the sheet opens. It asks
 * first, in a sheet of its own, and a failure is said in that confirmation.
 *
 * The `mock` prefix is what lets the `jest.mock` factory below read these: the
 * factory is hoisted above every `const` in this file, and babel-plugin-jest-hoist
 * refuses any other out-of-scope name.
 */
const mockMutate = jest.fn();
const mockReset = jest.fn();
const mockSignOutState = { isPending: false, isError: false };

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
jest.mock("../src/hooks/use-sign-out", () => ({
  useSignOut: () => ({ mutate: mockMutate, reset: mockReset, ...mockSignOutState }),
}));

import { AccountSheet } from "@/components/layout/AccountSheet";

beforeEach(() => {
  mockMutate.mockReset();
  mockReset.mockReset();
  mockSignOutState.isPending = false;
  mockSignOutState.isError = false;
});

test("Sign out is the first control in the account sheet, on screen as it opens", async () => {
  const s = await render(<AccountSheet visible onClose={jest.fn()} />);
  const labels = s.getAllByRole("button").map((n) => n.props.accessibilityLabel as string);
  expect(labels[0]).toBe("Sign out");
});

test("Sign out asks first: the account sheet steps aside for 'Sign out?' and nothing is signed out yet", async () => {
  const onClose = jest.fn();
  const s = await render(<AccountSheet visible onClose={onClose} />);
  await fireEvent.press(s.getByRole("button", { name: "Sign out" }));
  expect(s.getByText("Sign out?")).toBeTruthy();
  expect(s.getByText("Your dossier and everything you have saved stay on your account.")).toBeTruthy();
  expect(s.queryByText("Your account")).toBeNull();
  expect(mockMutate).not.toHaveBeenCalled();
  // The account sheet is closed for the header outright, not left to its
  // dismiss animation: "Not now" can then never re-present a sheet mid-close.
  expect(onClose).toHaveBeenCalledTimes(1);
  // A failure from an earlier attempt is cleared before she is asked again.
  expect(mockReset).toHaveBeenCalled();
});

test("confirming signs her out, once", async () => {
  const s = await render(<AccountSheet visible onClose={jest.fn()} />);
  await fireEvent.press(s.getByRole("button", { name: "Sign out" }));
  await fireEvent.press(s.getByRole("button", { name: "Sign out" })); // the confirm sheet's button
  expect(mockMutate).toHaveBeenCalledTimes(1);
});

test("Not now signs nothing out and closes the confirmation", async () => {
  const s = await render(<AccountSheet visible onClose={jest.fn()} />);
  await fireEvent.press(s.getByRole("button", { name: "Sign out" }));
  mockReset.mockClear();
  await fireEvent.press(s.getByRole("button", { name: "Not now" }));
  expect(mockMutate).not.toHaveBeenCalled();
  expect(s.queryByText("Sign out?")).toBeNull();
  expect(mockReset).toHaveBeenCalled();
});

test("a failed sign-out is said in the confirmation and she can try again", async () => {
  mockSignOutState.isError = true;
  const s = await render(<AccountSheet visible onClose={jest.fn()} />);
  await fireEvent.press(s.getByRole("button", { name: "Sign out" }));
  expect(s.getByText("Mila couldn't sign you out. Please try again.")).toBeTruthy();
  await fireEvent.press(s.getByRole("button", { name: "Sign out" }));
  expect(mockMutate).toHaveBeenCalledTimes(1);
});

test("while signing out the confirmation shows it is working and Not now waits", async () => {
  mockSignOutState.isPending = true;
  const s = await render(<AccountSheet visible onClose={jest.fn()} />);
  await fireEvent.press(s.getByRole("button", { name: "Sign out" }));
  expect(s.getByRole("button", { name: "Not now" }).props.accessibilityState).toMatchObject({
    disabled: true,
  });
});

test("every account row that was there before is still there", async () => {
  const s = await render(<AccountSheet visible onClose={jest.fn()} />);
  for (const name of [/^Membership/, /^Colour dossier/, /^Outfit archive/, /^Saved pieces/, /^Settings/]) {
    expect(s.getByRole("button", { name })).toBeTruthy();
  }
});

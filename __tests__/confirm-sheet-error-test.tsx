import { render } from "@testing-library/react-native";

/**
 * A confirmation that fails says so inside itself. The member's eyes are on the
 * sheet she just tapped in; an error drawn on the screen behind it is an error
 * she never sees.
 */
jest.mock("../src/components/ui/Sheet", () => require("../src/test-utils/sheet-mock"));

import { ConfirmSheet } from "@/components/ui/ConfirmSheet";

const base = {
  visible: true,
  onClose: jest.fn(),
  title: "Sign out?",
  message: "Your dossier and everything you have saved stay on your account.",
  confirmLabel: "Sign out",
  onConfirm: jest.fn(),
};

test("a failed action is said inside the confirmation, where she is looking", async () => {
  const s = await render(
    <ConfirmSheet {...base} error="Mila couldn't sign you out. Please try again." />,
  );
  expect(s.getByText("Mila couldn't sign you out. Please try again.")).toBeTruthy();
});

test("no error, no error line: the sheet is exactly what it was", async () => {
  const s = await render(<ConfirmSheet {...base} />);
  expect(s.queryByText(/couldn't/)).toBeNull();
  expect(s.getByRole("button", { name: "Sign out" })).toBeTruthy();
  expect(s.getByRole("button", { name: "Not now" })).toBeTruthy();
});

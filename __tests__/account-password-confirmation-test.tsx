import { fireEvent, render } from "@testing-library/react-native";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("../src/components/layout/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { email: string } } }) => unknown) =>
    select({ session: { user: { email: "member@example.test" } } }),
}));
jest.mock("../src/features/settings/hooks/use-account-actions", () => ({
  useChangeEmail: jest.fn(),
  useChangePassword: jest.fn(),
}));

import { AccountScreen } from "@/features/settings/AccountScreen";
import { useChangeEmail, useChangePassword } from "@/features/settings/hooks/use-account-actions";

test("password change stays blocked until confirmation matches, then clears all password fields", async () => {
  const mutate = jest.fn((_input, options) => options.onSuccess());
  jest.mocked(useChangeEmail).mockReturnValue({} as ReturnType<typeof useChangeEmail>);
  jest.mocked(useChangePassword).mockReturnValue({ mutate } as unknown as ReturnType<typeof useChangePassword>);
  const screen = await render(<AccountScreen />);
  await fireEvent.changeText(screen.getByLabelText("Current password"), "PreviousPass1!");
  await fireEvent.changeText(screen.getByLabelText("New password"), "NextPassword2!");
  await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "DifferentPass3!");
  await fireEvent.press(screen.getByRole("button", { name: "Change password" }));
  expect(mutate).not.toHaveBeenCalled();
  expect(screen.getByText("Passwords don't match.")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "NextPassword2!");
  await fireEvent.press(screen.getByRole("button", { name: "Change password" }));
  expect(mutate).toHaveBeenCalledWith(
    { currentPassword: "PreviousPass1!", newPassword: "NextPassword2!" },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
  for (const label of ["Current password", "New password", "Confirm new password"]) {
    expect(screen.getByLabelText(label).props.value).toBe("");
  }
});

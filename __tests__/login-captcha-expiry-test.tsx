import { fireEvent, render } from "@testing-library/react-native";
import { act } from "react";

import { LoginForm } from "@/features/auth/components/LoginForm";

/**
 * A token is spent the moment sign-in starts. hCaptcha still fires `expired` on
 * its own clock, so one landing while the request is in flight must not tell
 * her the check "timed out".
 */

const mockWidget: { onMessage: ((event: unknown) => void) | null } = { onMessage: null };
const mockSignIn = jest.fn();

jest.mock("@hcaptcha/react-native-hcaptcha", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: class MockHcaptcha extends React.Component<{ onMessage: (event: unknown) => void }> {
      show = jest.fn();
      hide = jest.fn();
      render() {
        mockWidget.onMessage = this.props.onMessage;
        return null;
      }
    },
  };
});

jest.mock("@/services/captcha", () => ({
  CAPTCHA_BASE_URL: "https://captcha.example",
  CAPTCHA_SITEKEY: "test-sitekey",
}));

jest.mock("@/services/api/auth", () => ({ UNIFORM_AUTH_FAILURE: "Those details did not work." }));

jest.mock("@/features/auth/hooks/use-auth-actions", () => ({
  useSignIn: () => ({
    isPending: false,
    // The request is "in flight" while this runs: the token expires inside it.
    mutateAsync: (...args: unknown[]) => {
      mockSignIn(...args);
      mockWidget.onMessage?.({ nativeEvent: { data: "expired" }, success: false });
      return Promise.resolve();
    },
  }),
}));

jest.mock("expo-router", () => ({ Link: ({ children }: { children: unknown }) => children }));

const TOKEN = "10000000-aaaa-bbbb-cccc-000000000001";

test("a token expiring while sign-in is in flight shows no timeout message", async () => {
  const screen = await render(<LoginForm />);

  await fireEvent.changeText(screen.getByLabelText("Email Address"), "nicole@example.com");
  await fireEvent.changeText(screen.getByLabelText("Security Password"), "correct-horse-1");
  await fireEvent.press(screen.getByRole("checkbox", { name: "Verify you are human" }));
  await act(async () => {
    mockWidget.onMessage?.({ nativeEvent: { data: TOKEN }, success: true });
  });
  await fireEvent.press(screen.getByText("Enter Mila Studio"));

  expect(mockSignIn).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("That check timed out. Tap to try again.")).toBeNull();
});

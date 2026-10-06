import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react-native";

/**
 * A failed email or password change must never show the identity provider's own
 * words: "A user with this email address has already been registered" tells a
 * signed-in member whether some other address has an account, and "email rate
 * limit exceeded" tells her nothing she can act on. The screen maps the
 * provider's error code to plain copy and falls back to a warm default for
 * anything it does not recognise.
 *
 * The hooks are stubs that hand the screen the error the provider would.
 */
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
jest.mock("../src/components/feedback/CaptchaGate", () =>
  require("../src/test-utils/captcha-gate-mock"),
);

import { AccountScreen } from "@/features/settings/AccountScreen";
import { useChangeEmail, useChangePassword } from "@/features/settings/hooks/use-account-actions";

/** The shape supabase-js hands back: an `Error` carrying a name, status and code. */
function providerError(message: string, code?: string, name = "AuthApiError"): Error {
  return Object.assign(new Error(message), { name, status: 422, code, __isAuthError: true });
}

function mockHooks({ email, password }: { email?: unknown; password?: unknown }) {
  jest.mocked(useChangeEmail).mockReturnValue({
    isError: email !== undefined,
    error: email,
    isSuccess: false,
    isPending: false,
    mutate: jest.fn(),
  } as unknown as ReturnType<typeof useChangeEmail>);
  jest.mocked(useChangePassword).mockReturnValue({
    isError: password !== undefined,
    error: password,
    isSuccess: false,
    isPending: false,
    mutate: jest.fn(),
  } as unknown as ReturnType<typeof useChangePassword>);
}

describe("change email", () => {
  test("an address that already has an account is not confirmed or denied", async () => {
    const raw = "A user with this email address has already been registered";
    mockHooks({ email: providerError(raw, "email_exists") });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText(raw)).toBeNull();
    expect(screen.queryByText(/already|registered/i)).toBeNull();
    expect(
      screen.getByText("That email can't be used for this account. Try a different one."),
    ).toBeTruthy();
  });

  test("an invalid address says to check it", async () => {
    mockHooks({
      email: providerError("Unable to validate email address: invalid format", "email_address_invalid"),
    });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText(/unable to validate/i)).toBeNull();
    expect(screen.getByText("That email doesn't look right. Check it and try again.")).toBeTruthy();
  });

  test("a malformed address reported as a validation failure says the same", async () => {
    mockHooks({
      email: providerError("Unable to validate email address: invalid format", "validation_failed"),
    });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText(/unable to validate/i)).toBeNull();
    expect(screen.getByText("That email doesn't look right. Check it and try again.")).toBeTruthy();
  });

  test("a send limit asks her to wait, without the provider's wording", async () => {
    const raw = "For security purposes, you can only request this after 49 seconds.";
    mockHooks({ email: providerError(raw, "over_email_send_rate_limit") });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText(raw)).toBeNull();
    expect(
      screen.getByText("You've tried that a few times. Wait a little while, then try again."),
    ).toBeTruthy();
  });

  test("an expired session asks her to sign in again", async () => {
    mockHooks({ email: providerError("Auth session missing!", "session_not_found") });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText(/auth session/i)).toBeNull();
    expect(screen.getByText("Please sign in again, then try once more.")).toBeTruthy();
  });

  test("a dropped connection is named as one", async () => {
    mockHooks({
      email: providerError("Failed to fetch", undefined, "AuthRetryableFetchError"),
    });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText("Failed to fetch")).toBeNull();
    expect(
      screen.getByText("Mila couldn't reach the studio. Check your connection and try again."),
    ).toBeTruthy();
  });

  test("a code it does not know falls back to warm copy, never the raw text", async () => {
    const raw = "unexpected_failure: relation auth.identities violates constraint";
    mockHooks({ email: providerError(raw, "unexpected_failure") });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText(raw)).toBeNull();
    expect(screen.getByText("We couldn't send that confirmation. Please try again.")).toBeTruthy();
  });

  test("an error that is not the provider's is not shown either", async () => {
    mockHooks({ email: new TypeError("Cannot read properties of undefined") });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText(/cannot read/i)).toBeNull();
    expect(screen.getByText("We couldn't send that confirmation. Please try again.")).toBeTruthy();
  });
});

describe("change password", () => {
  // The three messages the change-password re-auth words itself
  // (`useChangePassword`). Only these exact sentences are shown as written.
  const APP_MESSAGES = [
    "That current password isn't right.",
    "That human check didn't go through — verify again and retry.",
    "You need to be signed in to change your password.",
  ];

  test.each(APP_MESSAGES)("a message the app wrote itself still reaches her: %s", async (message) => {
    mockHooks({ password: new Error(message) });
    const screen = await render(<AccountScreen />);

    expect(screen.getByText(message)).toBeTruthy();
  });

  test("the allow-list is what the hook really throws, so a reworded message cannot silently vanish", () => {
    // The hook is stubbed everywhere else in this file; reading its source is
    // the cheapest way to keep the screen's list and its wording in step.
    const source = readFileSync(
      join(__dirname, "../src/features/settings/hooks/use-account-actions.ts"),
      "utf8",
    );
    for (const message of APP_MESSAGES) expect(source).toContain(message);
  });

  test.each([
    new Error("Cannot read properties of undefined (reading 'user')"),
    new TypeError("Network request failed"),
    new Error("duplicate key value violates unique constraint \"users_pkey\""),
    new Error(""),
  ])("any other error text is never shown, only the neutral fallback: %s", async (error) => {
    mockHooks({ password: error });
    const screen = await render(<AccountScreen />);

    if (error.message) expect(screen.queryByText(error.message)).toBeNull();
    expect(screen.getByText("We couldn't change your password. Please try again.")).toBeTruthy();
  });

  test("something that is not an Error at all falls back too", async () => {
    mockHooks({ password: "boom: stack trace here" });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText(/boom/)).toBeNull();
    expect(screen.getByText("We couldn't change your password. Please try again.")).toBeTruthy();
  });

  test("the provider's reuse rule is restated in plain words", async () => {
    mockHooks({
      password: providerError(
        "New password should be different from the old password.",
        "same_password",
      ),
    });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText(/should be different/i)).toBeNull();
    expect(
      screen.getByText("Choose a password you haven't used on this account before."),
    ).toBeTruthy();
  });

  test("a provider failure it does not know falls back to warm copy", async () => {
    const raw = "AuthApiError: unexpected_failure at /user";
    mockHooks({ password: providerError(raw, "unexpected_failure") });
    const screen = await render(<AccountScreen />);

    expect(screen.queryByText(raw)).toBeNull();
    expect(screen.getByText("We couldn't change your password. Please try again.")).toBeTruthy();
  });
});

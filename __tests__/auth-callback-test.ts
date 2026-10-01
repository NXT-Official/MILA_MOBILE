jest.mock("expo-auth-session", () => ({
  makeRedirectUri: jest.fn(() => "mila://auth/callback"),
}));
jest.mock("expo-web-browser", () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoVersion: null } }));
jest.mock("../src/services/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      setSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      signInWithOAuth: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));
jest.mock("../src/services/api/client", () => ({
  api: { post: jest.fn() },
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));
jest.mock("../src/services/supabase/analytics", () => ({ trackEvent: jest.fn() }));

import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";

import { authRedirectUri, changeEmail, completeAuthCallback, GOOGLE_NATIVE_BUILD_REQUIRED, signIn, signInWithGoogle, signUp } from "@/services/api/auth";
import { supabase } from "@/services/supabase/client";

const auth = jest.mocked(supabase.auth);
const browser = jest.mocked(WebBrowser.openAuthSessionAsync);
const session = { access_token: "test-access", refresh_token: "test-refresh", user: { id: "member" } };
const callback = "mila://auth/callback#access_token=test-access&refresh_token=test-refresh";

beforeEach(() => {
  jest.clearAllMocks();
  Constants.expoVersion = null;
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.setSession.mockResolvedValue({ data: { session, user: session.user }, error: null } as never);
  auth.exchangeCodeForSession.mockResolvedValue({ data: { session, user: session.user }, error: null } as never);
});

test("Expo Go never starts unsupported Google browser flow", async () => {
  Constants.expoVersion = "57.0.0";
  await expect(signInWithGoogle()).rejects.toThrow(GOOGLE_NATIVE_BUILD_REQUIRED);
  expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  expect(browser).not.toHaveBeenCalled();
});

test("Expo Go email confirmation keeps registered app return instead of website fallback", () => {
  Constants.expoVersion = "57.0.0";
  expect(authRedirectUri()).toBe("mila://auth/callback");
  expect(makeRedirectUri).not.toHaveBeenCalled();
});

test("changed-email confirmation returns to native app too", async () => {
  auth.updateUser.mockResolvedValue({ data: { user: session.user }, error: null } as never);
  await changeEmail("new@example.test");
  expect(auth.updateUser).toHaveBeenCalledWith(
    { email: "new@example.test" }, { emailRedirectTo: "mila://auth/callback" },
  );
});

test("installed builds explicitly request the registered Mila callback", () => {
  expect(authRedirectUri()).toBe("mila://auth/callback");
  expect(makeRedirectUri).toHaveBeenCalledWith({ native: "mila://auth/callback", scheme: "mila", path: "auth/callback" });
});

test("signup confirmation email returns to app rather than default website", async () => {
  auth.signUp.mockResolvedValue({ data: { session: null, user: session.user }, error: null } as never);
  const input = { email: "member@example.test", password: "test-password", username: "member", captchaToken: "test-captcha" };
  await expect(signUp(input)).rejects.toMatchObject({ code: "EMAIL_CONFIRMATION_REQUIRED" });
  expect(auth.signUp).toHaveBeenCalledWith({
    email: input.email, password: input.password,
    options: { captchaToken: input.captchaToken, emailRedirectTo: "mila://auth/callback", data: { username: input.username } },
  });
  expect(browser).not.toHaveBeenCalled();
});

test("password login remains native and never opens website", async () => {
  auth.signInWithPassword.mockResolvedValue({ data: { session, user: session.user }, error: null } as never);
  await expect(signIn({ email: "member@example.test", password: "test-password", captchaToken: "test-captcha" })).resolves.toEqual(session);
  expect(browser).not.toHaveBeenCalled();
});

test("Google provider authentication uses same app return and persists session", async () => {
  auth.signInWithOAuth.mockResolvedValue({ data: { provider: "google", url: "https://auth.test/authorize" }, error: null });
  browser.mockResolvedValue({ type: "success", url: callback });
  await expect(signInWithGoogle()).resolves.toEqual(session);
  expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "mila://auth/callback", skipBrowserRedirect: true } });
  expect(browser).toHaveBeenCalledWith("https://auth.test/authorize", "mila://auth/callback");
  expect(auth.setSession).toHaveBeenCalledWith({ access_token: "test-access", refresh_token: "test-refresh" });
});

test("cancelled Google browser never creates session", async () => {
  auth.signInWithOAuth.mockResolvedValue({ data: { provider: "google", url: "https://auth.test/authorize" }, error: null });
  browser.mockResolvedValue({ type: "cancel" } as never);
  await expect(signInWithGoogle()).resolves.toBeNull();
  expect(auth.setSession).not.toHaveBeenCalled();
});

test.each([
  callback,
  "mila://auth/callback?type=signup#access_token=test-access&refresh_token=test-refresh",
  "mila://auth/callback?access_token=test-access&refresh_token=test-refresh",
])("cold and warm callback parses tokens from %s", async (url) => {
  await expect(completeAuthCallback(url)).resolves.toEqual(session);
  expect(auth.setSession).toHaveBeenCalledWith({ access_token: "test-access", refresh_token: "test-refresh" });
});

test.each([
  "not a URL", "https://mila-umber.vercel.app/auth/callback#access_token=a&refresh_token=r",
  "mila://auth/other#access_token=a&refresh_token=r", "mila://auth/callback",
  "mila://auth/callback#access_token=a", "mila://auth/callback?error=access_denied#access_token=a&refresh_token=r",
])("rejects invalid, incomplete or failed callbacks without setting session: %s", async (url) => {
  await expect(completeAuthCallback(url)).rejects.toThrow("Please sign in again.");
  expect(auth.setSession).not.toHaveBeenCalled();
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
});

test("a callback already completed by browser does not set session again", async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null } as never);
  await expect(completeAuthCallback(callback)).resolves.toEqual(session);
  expect(auth.setSession).not.toHaveBeenCalled();
});

test("simultaneous route and browser callbacks exchange one single-use code", async () => {
  const results = await Promise.all([
    completeAuthCallback("mila://auth/callback?code=test-code"),
    completeAuthCallback("mila://auth/callback?code=test-code"),
  ]);
  expect(results).toEqual([session, session]);
  expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
});

test("rejected session exposes safe message rather than provider details", async () => {
  auth.setSession.mockResolvedValue({ data: { session: null, user: null }, error: { message: "internal provider detail" } } as never);
  await expect(completeAuthCallback(callback)).rejects.toThrow("Please sign in again.");
});

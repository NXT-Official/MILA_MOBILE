# Phase 01 — Authentication

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §3 screens 1–4, §4 session gate and
> guards, §5 auth, §6 error codes, §10 security, §15 Phase 1.

## Goal

Allow members to securely access Mila: create an account, sign in, restore a session across cold
starts, and be routed to the right destination on every launch.

---

## User Outcome

A member can create an account and enter the application securely. She stays signed in between
sessions, sees one uniform message when credentials fail, and lands on the correct screen — app,
onboarding, or the suspended block — without ever seeing a flash of the wrong one.

---

## Scope

- Screens: Splash / boot resolution, Login, Signup, Forgot password, Suspended
- Email + password auth **through the server**, not `signInWithPassword` directly
- Google OAuth via `expo-auth-session` → `signInWithIdToken`
- hCaptcha on login and signup, token reset after every attempt
- Session persistence in SecureStore; foreground-only auto-refresh
- The session gate (`resolveDestination`) and route guards
- Sign-out that clears the query cache
- The full §6 error taxonomy, including `ACCOUNT_SUSPENDED` → `/suspended`
- Password reset via `resetPasswordForEmail` + the `mila://reset-password` deep link
- Seeded test accounts for every later phase (see below)

---

## Not Included

- Onboarding steps or profile writes → Phase 02
- Any tab, Home surface, or member content → Phase 03
- Biometric re-authentication. The adapter contract may be stubbed; the feature is scheduled with the
  destructive-action re-prompt in Phase 08
- Change email / change password → Phase 08
- Account deletion → Phase 08
- Any role, permission, or staff check — **these must not exist in this codebase at all**

---

## Implementation Tasks

Ordered. Each task is one commit.

1. **Copy the auth schemas verbatim.** `lib/auth-input.ts` (Credentials, Signup) and
   `constants/password.ts` from the web project. Do not redefine them — the server parses with the
   same schemas and a drifted client schema produces a confusing double validation.
2. **Write `services/api/auth.ts`** — `signIn`, `signUp` against `POST /api/v1/auth/sign-in` and
   `/sign-up`, using the Phase 00 fetch client.
3. **Build `stores/auth-store.ts`** — a thin mirror of the Supabase listener: `session`, `loading`,
   `signingOut`. Not a user profile; that belongs to TanStack Query.
4. **Wire `onAuthStateChange`** in the root layout. On `SIGNED_OUT`, call `queryClient.clear()`.
5. **Write the session gate.** `features/auth/hooks/use-app-destination.ts` with the pure
   `resolveDestination()` function from §4 — no session → login, suspended → `/suspended`, profile
   incomplete → onboarding, else tabs. **Unit-test it first**; it is pure and it decides every launch.
6. **Hold the splash** with `SplashScreen.preventAutoHideAsync()` until the session and profile have
   resolved. Never flash an empty shell.
7. **Build the shared form primitives.** `components/ui/Input.tsx`, `Textarea.tsx`, `ErrorState.tsx`
   — variants only, no feature-specific styling.
8. **Build `AuthCard`** — the shared shell for all four auth screens.
9. **Build `CaptchaGate`.** Verify `@hcaptcha/react-native-hcaptcha` against SDK 57 first; fall back
   to a WebView pointing at a hosted challenge page if it does not work on RN 0.86. Submit stays
   disabled until a token exists; the token resets after every attempt, success or failure.
10. **Build `PasswordChecklist`** from the copied `constants/password.ts` strength rules.
11. **Build the Login screen** — `LoginForm`, `GoogleButton`, captcha. The failure message is always
    `"Email, password, or verification challenge is invalid."` **Never distinguish a bad email from a
    bad password.**
12. **Build the Signup screen** — email, username, password with live strength hints, captcha.
13. **Build Forgot password** — `resetPasswordForEmail` with `redirectTo: "mila://reset-password"`.
    Confirm the deep link opens the app.
14. **Build the Suspended screen** — full-screen block, exactly two actions: contact the steward
    (`Linking.openURL` mailto) and sign out.
15. **Wire Google OAuth** — `expo-auth-session` → id token → `signInWithIdToken` → session persists
    automatically.
16. **Apply the route guards** using `Stack.Protected` / `Tabs.Protected` in each group layout.
    Guards are a UX convenience; the server re-verifies the JWT and suspension on every call
    regardless.
17. **Map every §6 error code** in the auth path, especially `ACCOUNT_SUSPENDED` → `/suspended` and
    the single-retry 401. **No refresh loop** — one attempt, then sign out.
18. **Seed the test accounts** listed below and record the credentials in the team secret store, not
    the repo.

---

## Screens

| #   | Screen          | Route                     | Notes                                                 |
| --- | --------------- | ------------------------- | ----------------------------------------------------- |
| 22  | Splash / boot   | root `_layout`            | Session + profile resolution behind the native splash |
| 1   | Login           | `/(auth)/login`           | Email + password, Google, captcha                     |
| 2   | Signup          | `/(auth)/signup`          | Email, username, password strength, captcha           |
| 3   | Forgot password | `/(auth)/forgot-password` | New on mobile — the web has none                      |
| 4   | Suspended       | `/suspended`              | Full-screen block, two actions                        |

**User flow**

```text
Open app
  ↓
Hold splash · resolve session + profile
  ↓
no session ────────────────► /(auth)/login  ─── sign in / sign up ──┐
  ↓                                                                 │
suspended ─────────────────► /suspended                             │
  ↓                                                                 │
profile incomplete ────────► /(onboarding)/welcome   (Phase 02)     │
  ↓                                                                 │
complete ──────────────────► /(tabs)                 (Phase 03)  ◄──┘
```

---

## Components

**New primitives:** `Input` · `Textarea` · `ErrorState`

**Feature components:** `AuthCard` · `LoginForm` · `SignupForm` · `GoogleButton` · `CaptchaGate` ·
`PasswordChecklist`

Compose them from the Phase 00 primitives. If a variant is missing, add it to the primitive rather
than styling around it.

---

## Services / Integrations

| Service                    | Used for                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `services/api/auth.ts`     | `POST /api/v1/auth/sign-in`, `/auth/sign-up`                                                             |
| `services/supabase/client` | `setSession`, `getSession`, `onAuthStateChange`, `signOut`, `signInWithIdToken`, `resetPasswordForEmail` |
| `services/captcha.ts`      | hCaptcha token acquisition                                                                               |
| `expo-auth-session`        | Google OAuth id token                                                                                    |
| `expo-secure-store`        | Session storage — never `AsyncStorage`                                                                   |

Password sign-in goes through the server, not `supabase.auth.signInWithPassword`, for the same
reasons the web does it: uniform failure messaging, a server-side captcha path, and structured
auth-failure logging without PII.

**Backend dependency:** `POST /api/v1/auth/sign-in` and `/auth/sign-up` must be live in staging
before this phase starts. Supabase Auth must be configured for the `mila://` redirect and the Google
provider.

---

## Database Requirements

| Table      | Access   | How                                                                                   |
| ---------- | -------- | ------------------------------------------------------------------------------------- |
| `profiles` | read own | Direct, RLS-scoped — the boot check reads `suspended` and the six completeness fields |

No writes in this phase. No schema change, no new policy, no new RPC.

`profiles.suspended` is not writable by a member — the column grant excludes it. Do not attempt it.

### Test accounts to seed

Provision these now; Phases 03–09 cannot be exercised without them.

| Account                | State                                                          |
| ---------------------- | -------------------------------------------------------------- |
| Fresh member           | New signup, empty style profile                                |
| Complete, no credits   | Profile complete, `ai_credits = 0`, `purchased_credits = 0`    |
| Complete, with credits | Seeded `purchased_credits` — the only way to demo Phases 03–07 |
| Suspended member       | `profiles.suspended = true`                                    |

---

## State Requirements

| Owner               | Holds                                                  | Persisted                         |
| ------------------- | ------------------------------------------------------ | --------------------------------- |
| `supabase-js`       | The session itself                                     | `expo-secure-store`               |
| `stores/auth-store` | `session` mirror, `loading`, `signingOut`              | No — SecureStore owns the session |
| TanStack Query      | `profile(userId)` — 5 min stale, refetch on foreground | In-memory                         |

There is no user slice duplicating the profile. If a value can be re-derived from the server,
TanStack Query owns it.

---

## Testing Checklist

- [ ] Successful signup creates the account and lands on onboarding
- [ ] Successful login lands on the correct destination for that account's state
- [ ] Failed login shows exactly `"Email, password, or verification challenge is invalid."` — a bad
      email and a bad password are indistinguishable
- [ ] Submit stays disabled until a captcha token exists; the token resets after each attempt
- [ ] Invalid captcha fails with the same uniform message
- [ ] Logout clears the query cache and routes to login
- [ ] **Session restore:** full app kill and relaunch keeps the member signed in
- [ ] Google OAuth completes and returns to the app with a session
- [ ] A suspended account lands on `/suspended` and can only contact support or sign out
- [ ] A 401 mid-session refreshes once, then signs out — **no refresh loop**
- [ ] Password reset email arrives and `mila://reset-password` opens the app
- [ ] Airplane mode shows the network message, not a crash
- [ ] Deep-linking to a protected route while signed out routes to login and resumes afterwards
- [ ] No token appears in any log, breadcrumb, or crash report
- [ ] `resolveDestination()` unit tests cover all four outcomes

---

## Definition of Done

A user can securely create and access an account:

- Account creation, sign-in, sign-out, and session restore all work on a real device
- The uniform failure message holds for every credential and captcha failure
- The session gate routes correctly for all four account states
- Suspension is enforced client-side **and** the server's 403 path is exercised
- Test accounts are seeded and recorded
- Phase 00's gates still pass, and §17 of the architecture doc passes

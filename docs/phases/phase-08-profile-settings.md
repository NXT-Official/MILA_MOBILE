# Phase 08 — Profile Settings

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §3 Studio and settings screens, §5
> auth operations, §7 column protection, §10 privacy, §15 Phase 8.

## Goal

Let a member manage her account: view and edit her style dossier, change her credentials, control her
data, get help, and leave.

---

## User Outcome

A member controls her account. She can revisit the style profile she built in onboarding and change
any part of it, update her email or password, pick a default weather hub, export her data, contact
support, sign out, and delete her account from inside the app.

---

## Scope

- Studio dossier — the style profile as a readable, editable surface
- Saved palettes
- Member profile (own)
- Settings menu, account, default location, privacy, support
- Change email and change password (re-authentication required)
- Data export via the files adapter
- **Account deletion, reachable in the app** — an App Store requirement
- Theme preference
- Sign out

---

## Not Included

- Membership, plan changes, or billing → Phase 09
- Biometric re-authentication as a replacement for the password re-prompt. The adapter contract
  exists; implement it when it is scheduled, not before
- Any admin, moderation, or role surface. **These must not exist in this codebase**
- Notification preferences beyond what Phase 10 introduces

---

## Implementation Tasks

Ordered. Each task is one commit.

1. **Copy the remaining shared logic verbatim** — `lib/style-profile/studio-dossier.ts`,
   `lib/beauty-preferences.ts`, and `utils/error-message.ts`, `relative-time.ts`, `format-price.ts`
   split per function from the web's `lib/utils.ts`.
2. **Build the Studio dossier screen** — sections in order: dossier hero (season name, palette
   swatches, season tag), Silhouette, Face shape, Hair, Beauty preferences, Saved palettes strip, and
   "Retake analysis" at the bottom.
3. **Make every dossier row tappable**, re-entering the corresponding Phase 02 onboarding step in
   **edit mode**. Do not build a second set of editors — reuse the step components.
4. **Build the Season tag component** carefully. Its swatch colour is data, and it must always pair
   the swatch with the season's name: a portion of the audience cannot distinguish the swatches at
   all.
5. **Build saved palettes** — the strip, the full list, and delete.
6. **Build the settings menu** — a list, not a grid.
7. **Build the account screen** — change email via `updateUser({ email })`; change password as the
   two-step re-auth the web uses (`signInWithPassword`, then `updateUser({ password })`).
8. **Build the location screen** — the 10 hubs plus device location, reusing the Phase 02 location
   service.
9. **Build the privacy screen** — data export and account deletion.
10. **Implement data export** — assemble client-side from `profiles`, `outfits`, `posts`,
    `user_favorites`, write with `expo-file-system`, and hand off through the **Phase 05 files
    adapter**. That is why the screen has no platform code in it.
11. **Implement account deletion** — type-your-email confirmation, then `POST /account/delete`. It
    cancels billing immediately, purges storage, deletes the auth user, and cascades every row.
12. **Build the support screen** — help and feedback with a captcha, reusing `CaptchaGate` from
    Phase 01.
13. **Wire theme preference** into settings, reading the Phase 00 store.
14. **Wire sign-out** — `signOut()` → `queryClient.clear()` → `router.replace("/(auth)/login")`.
15. **Verify the permitted column list** is respected by every profile write in the phase.

---

## Screens

| #   | Screen           | Route                | Notes                                            |
| --- | ---------------- | -------------------- | ------------------------------------------------ |
| 8   | **Studio**       | `/(tabs)/studio`     | Replaces the Phase 03 placeholder                |
| 12  | Saved palettes   | `/palettes`          | Swatches, names, vibe, delete                    |
| 13  | Member profile   | `/profile/[userId]`  | Existing from Phase 06 — own profile view        |
| 16  | Settings         | `/settings`          | Menu list                                        |
| 17  | Account          | `/settings/account`  | Change email, change password (re-auth required) |
| 18  | Default location | `/settings/location` | 10 hubs + device location                        |
| 19  | Privacy & data   | `/settings/privacy`  | Export JSON, delete account                      |
| 20  | Support          | `/settings/support`  | Help / feedback + captcha                        |

---

## Components

`DossierHero` · `SeasonTag` · `DossierRow` · `PaletteStrip` · `PaletteCard` · `SettingsList` ·
`SettingsRow` · `ThemeToggle` · `DeleteAccountSheet` · `ExportDataButton` · `SupportForm`

Reused: `Card`, `Input`, `Button`, `Sheet`, `ConfirmSheet`, `CaptchaGate`, `EmptyState`, `Icon`.

Destructive confirmations use `ConfirmSheet` — **never `Alert.alert`**.

---

## Services / Integrations

| Service / endpoint         | Used for                                                   |
| -------------------------- | ---------------------------------------------------------- |
| `services/supabase/client` | `updateUser`, `signInWithPassword` re-auth, `signOut`      |
| Direct Supabase            | `profiles`, `saved_palettes`, `user_favorites`             |
| `services/api/account.ts`  | `POST /api/v1/account/delete`                              |
| `services/api/support.ts`  | `POST /api/v1/support/message` — **unauthenticated route** |
| `services/api/posts.ts`    | Member profile read (Phase 06)                             |
| `services/files/`          | **Platform adapter** — write and share the export file     |
| `services/location.ts`     | Default hub selection                                      |

Support submission is verified against hCaptcha server-side, plus a 3-per-15-minutes IP rate limit.

---

## Database Requirements

| Table            | Access               | How                             |
| ---------------- | -------------------- | ------------------------------- |
| `profiles`       | read own, update own | Direct — permitted columns only |
| `saved_palettes` | insert, read, delete | Direct                          |
| `outfits`        | read own             | Direct — export                 |
| `user_favorites` | read                 | Direct — export only            |
| `posts`          | read own             | via API — export                |

**Permitted profile columns** (unchanged from Phase 02):

```text
full_name · username · skin_undertone · color_season · body_type ·
color_profile · face_shape · hair_type · beauty_preferences ·
default_location · updated_at
```

`suspended` and `paddle_customer_id` are excluded from the grant. A member cannot clear her own
suspension even with a valid session — do not attempt the write.

---

## State Requirements

| Owner                | Holds                                             | Persisted                        |
| -------------------- | ------------------------------------------------- | -------------------------------- |
| TanStack Query       | `profile(userId)` — invalidated after every edit  | In-memory                        |
| TanStack Query       | `savedPalettes(userId)` — 60 s, after save/delete | In-memory                        |
| `stores/theme-store` | Theme preference                                  | `AsyncStorage`, key `mila-theme` |
| `useState`           | Form fields, confirmation text                    | —                                |

Editing a dossier row reuses the Phase 02 onboarding store for the in-flight draft, then invalidates
`profile`.

---

## Testing Checklist

- [ ] **Update profile:** edit a dossier row, save, and see it reflected in Studio
- [ ] **Save changes** persist across a cold start
- [ ] Only the permitted column list is ever sent — a `suspended` write is never attempted
- [ ] Change email sends the confirmation and updates after it
- [ ] Change password requires re-auth and rejects a wrong current password
- [ ] **Logout** clears the query cache and returns to login
- [ ] **Account deletion** requires typing the email, then cancels billing, purges storage, and signs out
- [ ] Account deletion is **reachable in the app** — App Store requirement
- [ ] Data export produces a readable JSON file through the share sheet
- [ ] Support form requires a captcha and enforces the rate limit
- [ ] Editing a dossier row returns to Studio with the value updated
- [ ] Theme preference persists across a cold start
- [ ] Default location change updates the Home climate widget
- [ ] Saved palette delete removes it everywhere it appears
- [ ] Season tag always shows the season name beside the swatch
- [ ] Destructive confirmations use `ConfirmSheet`, never `Alert.alert`
- [ ] TalkBack reads every settings row and its state

---

## Definition of Done

The user can manage their account:

- Profile editing, credential changes, data export, support, sign-out, and deletion all work on a
  real device
- Account deletion is reachable in-app and completes end to end
- No profile write attempts a protected column
- No admin, moderation, or role surface exists in the codebase
- Phase 00–07 gates still pass, and §17 of the architecture doc passes

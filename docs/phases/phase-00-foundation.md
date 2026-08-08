# Phase 00 — Foundation

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §2 folder structure, §5 Supabase
> client, §11 design system, §12 platform strategy, §15 Phase 0. This file says what to do, in what
> order, and how to know it is finished.

## Goal

Prepare the React Native application foundation: the app launches, routes, themes, styles, and
renders an icon — and every quality gate that guards the next ten phases already runs before a single
feature is written.

---

## User Outcome

None. No member-facing capability ships in this phase. The outcome is a developer one: any feature
started after this phase inherits the correct structure, tokens, lint rules, and verification
commands by default rather than by discipline.

---

## Scope

- Expo project configuration migrated to `app.config.ts`, env-driven, per profile
- TypeScript strict mode confirmed; Jest types added
- Expo Router shell — root layout, providers, `+not-found`
- The §2 folder structure, created empty where later phases fill it
- NativeWind + Tailwind wired to the §11 token set
- Theme provider with light / dark / system, persisted, no launch flash
- Lucide icon system behind `components/ui/Icon.tsx`
- Environment configuration and the `.env.example` contract
- Supabase client construction with the SecureStore adapter (**construction only** — no auth flows)
- EAS build profiles
- ESLint rule set, Jest setup, and the five verification commands
- **Server-side, in parallel:** `withMobileAuth`, `jsonError`, and the handler-body extraction
  (architecture doc, Appendix B) — Phase 01 is blocked without them

---

## Not Included

- Any screen a member sees. The temporary index route is scaffolding and is replaced in Phase 03
- Authentication flows, session gate, or route guards → Phase 01
- Any `services/api/*` caller beyond `client.ts` → Phase 01 onward
- Platform adapters for camera, notifications, biometrics, files → written when first needed
  (Phase 05), with contracts stubbed here only if convenient
- The full `components/ui/*` set. Only the primitives Phase 00 needs to prove the system works
- Fonts beyond the two families named in §11
- Analytics or crash reporting → Phase 10

---

## Implementation Tasks

Ordered. Each task is one commit.

1. **Clean the scaffold.** Delete `example/`, the template assets (`react-logo*`, `expo-badge*`,
   `expo-logo`, `tutorial-web`), and the placeholder body of `src/app/index.tsx`. Scaffolding that
   survives Phase 00 gets copied into features.
2. **Migrate `app.json` → `app.config.ts`.** Env-driven, per profile. **Set `scheme` to `mila`** —
   it is currently `milamobile`, which breaks every `mila://` URL in §4, §5, and §9 (OAuth callback,
   password reset, checkout return).
3. **Add the package scripts:** `typecheck` (`tsc --noEmit`), `test` (`jest`), `scan:secrets`. Keep
   the existing `lint`.
4. **Install and ratify the dependency set.** Use `npx expo install`, then `npx expo-doctor`. Pin
   `nativewind@4.2.x` and `tailwindcss@3.4.x`. Render each risky package once on a real device before
   it is written into a feature — `@gorhom/bottom-sheet`, `@shopify/flash-list`, and
   `@hcaptcha/react-native-hcaptcha` against Reanimated 4 / RN 0.86 are the ones that can fail.
5. **Configure NativeWind.** `babel.config.js`, `metro.config.js`, `tailwind.config.js`,
   `nativewind-env.d.ts`, and `src/theme/global.css`.
6. **Write the design tokens.** `theme/tokens.ts`, `typography.ts`, `icons.ts` — values copied
   exactly from §11. `global.css` holds the CSS variables and is the only file with raw colour values.
7. **Guard token drift.** A unit test asserting every token in `tokens.ts` has a matching CSS
   variable, or a script that generates one from the other. Two hand-maintained palettes diverge.
8. **Build the theme provider.** `theme/theme.ts` + `stores/theme-store.ts`, persisted to
   `AsyncStorage` under `mila-theme`. Hold the native splash until the stored preference is read — a
   light-to-dark flash on launch is the one thing that makes a premium app feel cheap.
9. **Build the icon system.** `components/ui/Icon.tsx` with the registry allow-list, the size scale,
   and `strokeWidth: 1.75`.
10. **Build the first primitives.** `Button` (CVA, two variant maps), `Card`, `Divider`, and
    `utils/cn.ts`. Register Mila's custom class groups with `extendTailwindMerge` or `cn()` will
    resolve conflicting radii arbitrarily.
11. **Build the screen shell.** `components/layout/Screen.tsx` using `useSafeAreaInsets()`.
12. **Create the folder structure** from §2, with a `.gitkeep` where a later phase fills it. No
    speculative files.
13. **Write `.env.example`** with exactly the four public values (below) and nothing else. Configure
    the same four in EAS as environment variables, not secrets.
14. **Write `eas.json`** with the three profiles from §12: development, preview, production. Android
    keys only today; adding iOS later means adding an `ios` key to each existing profile, never a new
    profile.
15. **Write the ESLint rule set.** Import boundaries (`no-restricted-paths`), `lucide-react-native`
    importable only inside `Icon.tsx`, `Platform.OS` banned outside `services/`/`theme/`/`_layout`,
    and arbitrary Tailwind values (`\[#`) banned outside `theme/`.
16. **Set up testing.** `jest-expo`, `jest`, `@types/jest`, `@testing-library/react-native`. Add
    `"jest"` to `tsconfig` types. Not `react-test-renderer` — it is deprecated and has no React 19
    support.
17. **Construct the Supabase client.** `services/supabase/client.ts` with the chunking SecureStore
    adapter and foreground-only auto-refresh, plus the generated `types.ts` copied from the web. No
    auth calls yet — this task proves the client builds and reaches the project.
18. **Write `services/api/client.ts`** — base URL, bearer token, timeout, the single-retry 401 path,
    and the §6 error-code mapping. No endpoint callers yet.
19. **Configure TanStack Query.** `services/query-client.ts` with the §6 defaults: never retry
    `INSUFFICIENT_CREDITS`, `RATE_LIMITED`, `UNAUTHENTICATED`, `ACCOUNT_SUSPENDED`, or
    `VALIDATION_FAILED`; mutations never retry.
20. **Write `platform/android/README.md` and `platform/ios/README.md`.** Both, now. Writing the iOS
    one during Android development is what keeps iOS from becoming a discovery project.
21. **Write `AGENTS.md`.** Already done — verify it is accurate against what this phase actually
    built, and correct it if not.
22. **Run every gate and fix what fails.** Then commit.

---

## Screens

| Screen          | Route                 | Purpose                                                                       |
| --------------- | --------------------- | ----------------------------------------------------------------------------- |
| Root layout     | `src/app/_layout.tsx` | Providers, fonts, splash control, theme                                       |
| Not found       | `/+not-found`         | The §3 catch-all                                                              |
| Temporary index | `/`                   | Scaffolding — proves routing, styling, and icons render. Replaced in Phase 03 |

---

## Components

`components/ui/Icon.tsx` · `Button.tsx` · `Card.tsx` · `Divider.tsx` ·
`components/layout/Screen.tsx` · `utils/cn.ts`

Everything else waits until a feature needs it. Do not build the full §2 primitive list
speculatively — an unused `Select` written now is a `Select` written against a guess.

---

## Services / Integrations

| Service                    | State after this phase                                                   |
| -------------------------- | ------------------------------------------------------------------------ |
| `services/supabase/client` | Constructed, SecureStore adapter working, reaches the project            |
| `services/api/client`      | Written with error mapping and the 401 path. No callers                  |
| `services/query-client`    | Configured with the §6 defaults                                          |
| EAS                        | Three build profiles; development build installs on a device             |
| **Backend (web repo)**     | `withMobileAuth` + `jsonError` live in staging; handler bodies extracted |

---

## Database Requirements

None. No table is read or written in this phase.

The only database interaction is proving the Supabase client authenticates its connection and that
the generated types compile. `services/supabase/types.ts` is copied verbatim from the web project and
regenerated in both projects whenever the schema changes.

---

## State Requirements

| Store / cache        | Holds                                 | Persisted |           |                                  |
| -------------------- | ------------------------------------- | --------- | --------- | -------------------------------- |
| `stores/theme-store` | `"light" \                            | "dark" \  | "system"` | `AsyncStorage`, key `mila-theme` |
| TanStack Query       | Configured, no queries registered yet | —         |           |                                  |

No other store exists yet. `auth-store` arrives in Phase 01.

---

## Environment configuration

`.env.example` is committed; `.env.local` is gitignored. Exactly four values, all public by design:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_API_BASE_URL=          # https://<host>/api/v1
EXPO_PUBLIC_HCAPTCHA_SITEKEY=
```

No other variable may be added without a line in the architecture doc's §10 secrets table. A
non-`EXPO_PUBLIC_` name in this file is a build failure, and `npm run scan:secrets` is what fails it.

---

## Testing Checklist

- [ ] `npx expo run:android` launches on a real device **and** an emulator
- [ ] Navigating between two routes works; `+not-found` renders on a bad path
- [ ] A `className` visibly applies (`bg-canvas`, `text-ink`) in both themes
- [ ] Theme toggles light → dark → system; the choice survives a cold start
- [ ] **No light-to-dark flash on launch**
- [ ] `<Icon name="camera" size="md" />` renders at 22px, stroke 1.75, correct token colour
- [ ] Environment variables load — log the API base URL once at boot, then delete the log
- [ ] Supabase client constructs and a session read returns `null` without throwing
- [ ] SecureStore chunking adapter round-trips a >2 KB string
- [ ] `npm run typecheck` · `lint` · `test` · `scan:secrets` all exist and pass
- [ ] Lint **fails** on a deliberate violation of each rule: `bg-[#c9a96e]`, a direct
      `lucide-react-native` import outside `Icon.tsx`, `Platform.OS` in a feature, an upward import
- [ ] `npx expo-doctor` is clean
- [ ] An EAS development build installs and launches on a physical device

---

## Definition of Done

The project is ready for feature development:

- App launches · navigation works · styling works · icons render · environment variables load
- Theme switches and persists with no launch flash
- `AGENTS.md` exists and is accurate
- All five verification commands pass, and the lint rules demonstrably reject violations
- The deep-link scheme is `mila`
- `withMobileAuth` is live in staging
- No scaffolding, template asset, or placeholder screen remains

# Release setup

Everything in this repo that a developer can finish alone is finished. What's
left below all requires accounts, credentials, or copy that belong to the
client — this file is the punch list, not a how-to for things already done.

## 1. EAS project — done (2026-09-23)

Linked to `@kurtgav/mila-mobile`; the project ID lives in `app.config.ts`'s
`extra.eas.projectId` (the `EAS_PROJECT_ID` env override remains for anyone
building against a different project). All three `eas.json` profiles target it.

Cloud builds never see `.env.local` (gitignored), so every profile's `env`
block in `eas.json` carries the public `EXPO_PUBLIC_*` values
(SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / HCAPTCHA_SITEKEY / API_BASE_URL) —
they are public by design and ship inside the binary. Keep `eas.json` and
`.env.local` in step when either changes; the first cloud build failed at
launch with `Missing EXPO_PUBLIC_SUPABASE_URL` before this was set.

## 2. Apple — App Store Connect

- An Apple Developer Program membership (Team ID) under the client's own
  account.
- An App Store Connect API key (Issuer ID, Key ID, `.p8` file) for
  `eas submit --platform ios`. EAS asks for these interactively the first time,
  or they can be set as EAS secrets.
- `store.config.json` at the repo root has placeholder App Store listing copy
  (title, subtitle, description, keywords, support/marketing/privacy URLs) —
  every value is scaffolding and must be replaced with real, reviewed
  marketing copy before running `eas metadata:push`. Do not submit the
  placeholder text.

## 3. Google — Play Console

- A Google Play Developer account and the app's package registered there
  (`com.mila.app`, per `app.config.ts`).
- A Play Console service-account JSON key (Setup > API access) for
  `eas submit --platform android`.
- `eas metadata` (the EAS CLI's store-metadata tool) only manages Apple App
  Store listings as of the installed `eas-cli` version — there is no Google
  Play equivalent. `eas/metadata/google-play.json` is a placeholder reference
  for entering the same listing information by hand into Play Console (Grow >
  Store presence > Main store listing); it is not consumed by any command.
- The production AAB is already built and verified on EAS (versionCode 4,
  2026-09-26 — see §7) —
  upload it to Play Console once the account exists, then append the Play App
  Signing fingerprint to the web repo's assetlinks.json (see §6).

## 4. Sentry

- Create a Sentry project (React Native / Expo) under the client's
  organization.
- Populate in `.env.local`: `EXPO_PUBLIC_SENTRY_DSN` (from the project's
  Client Keys page), `SENTRY_ORG`, `SENTRY_PROJECT` (the org/project slugs the
  `@sentry/react-native/expo` config plugin needs for source-map/symbol
  upload — see `app.config.ts`).
- Without `EXPO_PUBLIC_SENTRY_DSN`, `Sentry.init`'s `enabled` guard (in
  `src/services/crash-reporting.ts`) keeps reporting off — this is the correct
  state for local development, not something to work around.
- Every `eas.json` profile currently sets `SENTRY_DISABLE_AUTO_UPLOAD=true`
  because the SDK's build-time upload task fails the release build when no
  org/project exists (it does not skip itself; the first Android build failed
  on exactly this). When the Sentry project is created, remove that entry,
  set `SENTRY_AUTH_TOKEN` (EAS secret or build env), and source-map/symbol
  uploads resume — the same flag also gates the iOS upload script.

## 5. Legal — privacy policy and terms of service

- Pages are hosted at `https://mila-umber.vercel.app/privacy` and `/terms`,
  and both store listings already point at the privacy URL. The page copy
  still says "pending legal review" — final legal approval and copy are
  client-owned.
- If the pages move to a client-owned domain, update `store.config.json`'s
  `privacyPolicyUrl` / `eas/metadata/google-play.json`'s `privacyPolicyUrl`
  and the store listing forms to match.

## 6. Associated domains (deep linking)

- Supabase Auth > URL Configuration must include the exact redirect URLs
  `mila://auth/callback` and `mila://reset-password`. Both were added and verified
  on the live project on 2026-10-01. Keep the existing website Site URL and web
  redirects. Email templates must use `{{ .ConfirmationURL }}` rather than a
  hardcoded web-only confirmation route.
- A rebuilt APK is required for the signup `emailRedirectTo` and native callback
  screen fix. Generate a fresh confirmation email from the updated app; emails
  issued by an older build still carry the website return URL.

- Android is live (2026-09-23): `MILA/public/.well-known/assetlinks.json`
  serves `com.mila.app` with the EAS production signing certificate. After the
  first Play upload, append the Play App Signing certificate fingerprint (Play
  Console > App integrity) to the same file — Play re-signs the uploaded app,
  and that is the certificate installed devices verify.
- iOS still needs the `apple-app-site-association` file, which needs the Apple
  Team ID from the Developer Program membership and the final production
  domain. Once both exist, host the file and add `ios.associatedDomains` to
  `app.config.ts`, e.g. `["applinks:<real-domain>"]` — no placeholder or
  invented domain; an `associatedDomains` entry pointing at a domain that
  doesn't serve the AASA file fails silently rather than loudly, which is
  worse than the feature simply not existing yet.

## 7. First real build and submission

### October 1 scope update

Google OAuth and signup/email-change confirmation return to native `/auth/callback` in installed
Mila. Expo Go blocks Google OAuth before browser launch. Email confirmation retains the registered
`mila://auth/callback` URI; Expo Go testers confirm email, then return and sign in with password.
Full callback testing requires the installed app. See [Expo OAuth](https://docs.expo.dev/guides/authentication/).

Native purchases were approved, replacing the earlier permanent web-only decision. `expo-iap`
5.8.2 and its config plugin are installed. Real charges are **not enabled**: store product IDs/base
plans, server verification/lifecycle notifications, provider-aware backend storage, and real-device
ratification are required. Current subscription rows require Paddle IDs, so fake Paddle IDs are
forbidden. No schema was changed. Existing memberships have native cancel/resume via existing APIs.

Expo Go cannot run real purchases or custom dictation. SDK validation currently passes 20/21 checks;
existing SDK 57 patch mismatches remain. See [native payment requirements](docs/mobile-architecture.md#9-payment-integration).

### Earlier release record

Android production build is done and verified (2026-09-26, versionCode 4):
https://expo.dev/accounts/kurtgav/projects/mila-mobile/builds/f6123d45-77d0-48ed-b0b7-24b4283db074

Verified before hand-off: the AAB is signed and structurally complete; its JS
bundle carries the live API URL and the Supabase project ref; and the same
codebase's installable build (preview profile) was installed on an Android 16
emulator — it boots, renders the full login screen including the hCaptcha
widget, and logs no errors. Local copies of both artifacts live in
`~/NXT Official/release-artifacts/`.

Once the accounts above are in place:

```bash
eas build --profile production --platform ios
eas submit --platform ios
eas submit --platform android   # uploads the already-built AAB
```

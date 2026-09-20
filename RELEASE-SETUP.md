# Release setup

Everything in this repo that a developer can finish alone is finished. What's
left below all requires accounts, credentials, or copy that belong to the
client — this file is the punch list, not a how-to for things already done.

## 1. EAS project

- Run `eas login`, then `eas init` from the repo root. This creates (or links)
  the Expo project and writes the project ID back into `app.config.ts`'s
  `extra.eas.projectId` read — populate `EAS_PROJECT_ID` in `.env.local` (see
  `.env.example`) with the value `eas init` prints.
- Confirm `eas.json`'s three build profiles (`development`, `preview`,
  `production`) target the right Expo account/project once `eas init` has run.

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

## 5. Legal — privacy policy and terms of service

- Neither a privacy-policy page nor a terms-of-service page is published
  anywhere yet. The app itself only has an in-app data-export and
  account-deletion screen (`src/features/settings/PrivacyScreen.tsx` and
  friends) — that is not a substitute for a hosted policy page, and both Apple
  and Google require a live URL at submission time.
- Once the client has hosted pages (on the marketing site or elsewhere), their
  URLs go into `store.config.json`'s `privacyPolicyUrl` /
  `eas/metadata/google-play.json`'s `privacyPolicyUrl`, and into the App Store
  Connect / Play Console listing forms directly.

## 6. Associated domains (deep linking)

- Universal Links / the `apple-app-site-association` file are being hosted as
  separate work in the MILA web repo, once the production domain is decided.
- Once that domain is live, add `ios.associatedDomains` to `app.config.ts`
  here, e.g. `["applinks:<real-domain>"]` — do not add a placeholder or
  invented domain in the meantime; an `associatedDomains` entry pointing at a
  domain that doesn't serve the AASA file fails silently rather than loudly,
  which is worse than the feature simply not existing yet.

## 7. First real build and submission

Once the above are in place:

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
eas submit --platform ios
eas submit --platform android
```

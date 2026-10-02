# Native member parity — October 1, 2026

Goal: the website's member capabilities run as native React Native screens against the same Mila
backend. A native implementation existing in source is not proof that its live flow passed.

| Member capability | Native implementation | Verification / remaining work |
| --- | --- | --- |
| Password login, signup, email confirmation, Google | `services/api/auth.ts`, auth screens, `/auth/callback` | App return fixed and regression-tested; successful live account/provider tests still needed. Expo Go supports password login; custom-scheme Google requires installed app. Email confirmation returns to installed app, then Expo Go testers can sign in by password. |
| Password recovery, email/password changes | Recovery and native Account screens | Email-change return now uses same app callback. Live email/recovery checks still needed. |
| Onboarding and dossier | Native step machine, manual season library, dossier editors | Manual palette template faces no longer fill the required face answer. Real saved answers and legacy AI faces remain supported. Website's onboarding camera tile is currently commented out too. No default `MOOD_COLLECT_DEFAULT` dossier is rendered by native features. |
| Studio camera colour analysis | Website `StyleProfile` opens `VisualDiagnosticViewfinder`; native dossier colour editor is manual | **Gap:** native camera colour analysis and the planned `/analysis/personal-color` server adapter are absent. Migrate real analysis and error/credit handling; never substitute a sample face or fabricated result. |
| Daily looks, weather, occasions, dress code | `HomeScreen`, weather/vibe/plan controls, existing look API services | Implemented in source; paid live generation and visual flows not tested in this change. |
| Consented selfie, style sheet, portrait preview | Native selfie hooks/media controls; server look APIs | Implemented in source, including removal. Real portrait identity/consent/upload flows need device tests. |
| Lens outfit analysis, dupes, similar items | Native capture/result screens and existing analysis/item APIs | Implemented in source; live camera, upload, analysis, and insufficient-credit checks still needed. |
| Community, dual capture, post editing/tagging, member profiles | Native Feed, publish/capture and profile screens | Implemented in source; live posting, tagging, source links and hidden-own-post visibility need tests. |
| Concierge, history, anchored looks | Native chat, conversation sheet, server APIs | Implemented in source. Custom dictation requires installed native module; Expo Go hides microphone. |
| Local makeup/colour try-on | Native Studio camera/gallery preview and SVG overlay | Implemented; native overlay approximates web blend mode by design. Real camera/permission checks needed. |
| Saved looks, analyses and palettes | Native History, detail and Palettes screens | Implemented in source; live save/delete/export flows need account tests. |
| Account, location, privacy/export/delete, support | Native Settings screens and existing services | Core actions exist. Website account preferences do not offer username/full-name editing either. Native password confirmation now matches web and email-change guidance covers both inboxes. Password-change receipt email still needs a backend adapter. Live export/delete/support checks remain. |
| Membership status and credits | Native plans/status/credit display | Existing server data remains authoritative. |
| Cancel/resume existing membership | Native confirmation sheets and existing server APIs | Added and regression-tested without contacting billing provider. Live sandbox membership test needed. |
| Native purchases/restore | Approved `expo-iap` 5.8.2 and config plugin | **Not enabled:** store products and mappings, server receipt verification/notifications, provider-aware backend storage, and physical-device ratification are missing. Architecture §9 defines prerequisites. Real purchases cannot run in Expo Go. |

Admin/staff tools remain excluded by the project's member-only architecture.

## Release gates

- Typecheck, lint, all 35 test suites (425 tests), and bundle/git-history secret scan pass for current changes.
- Expo Doctor currently passes 20/21 checks; existing SDK 57 patch version mismatches remain.
- Native Google/email return, successful onboarding, paid member features, camera, and store billing
  require live testing. An emulator callback error test cannot prove successful registration.
- Store purchasing must not be claimed complete or enabled before server verification and store
  setup exist. Current database requires Paddle subscription/customer IDs; do not invent them.
- Expo Go emulator boot did not reach a usable member screen during verification: screenshots
  were black or showed the loading screen, and Metro reported a device connection timeout.
  No successful Expo Go end-to-end or physical Android test is claimed.
- Updated signed preview build submitted: [Android build](https://expo.dev/accounts/kurtgav/projects/mila-mobile/builds/ab956297-21a1-4e2d-8333-e58cbbc825f2).
  Submission returned `NEW`; APK completion has not been verified.

References: [Expo OAuth](https://docs.expo.dev/guides/authentication/),
[Expo native purchases](https://docs.expo.dev/guides/in-app-purchases/),
[OpenIAP SDK 57 setup](https://www.openiap.dev/docs/setup/expo).

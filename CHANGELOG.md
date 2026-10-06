# Changelog

## 2026-10-06/07 — Pre-demo fixes (`nicoleDev`, 5 commits on `main` `44004c1`)

### Fixed
- **Home:** with no city set, the weather card shows the city picker instead of a skeleton that never ends (which also kept "Create my look" disabled).
- **Home:** "Try another look" and "Create my look" wait for the style sheet and portrait preview; a late result can't attach to a newer look.
- **Sign-in:** closing the hCaptcha challenge no longer shows "Verified".
- **Crash safety:** a branded error screen with Retry instead of the app closing; it also lifts the splash screen.
- **Onboarding:** a failed profile refresh no longer sends a complete member back into the onboarding wizard.
- **Membership and paywall:** no purchase dead ends while payments are closed; no "credits reset tomorrow" promise to members without a plan.
- **Feed:** "View AI blueprint" shows only on your own posts.
- **Lens / posting:** closing mid-request says the request may still finish; the sheet can't contradict a finished request.
- **Account:** email and password errors are plain sentences, never provider text; the account sheet shows @username, never part of the email.

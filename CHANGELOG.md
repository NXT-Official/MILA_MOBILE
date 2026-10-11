# Changelog

## 2026-10-11 — Sign out from the avatar (`nicoleDev`, on `main` `6fb13ee`)

### Changed
- **Account sheet:** the avatar's "Your account" sheet has a **Sign out** button in its title row, on screen the moment the sheet opens on any phone size. Before, Sign out was only at the bottom of Settings (four taps and a scroll). The sheet's content is taller than its 80% height, so a row at the bottom would have been below the fold.
- Tapping it hands over to the same "Sign out?" confirmation Settings uses. If sign-out fails, the confirmation says so ("Mila couldn't sign you out. Please try again.") and the button works again. "Not now" returns to the screen.
- Settings' own Sign out, the suspended screen and every account-sheet row are unchanged.

### Added (primitives)
- `Sheet` takes an optional `headerAction`, shown at the end of the title row. Every sheet without one renders exactly as before.
- `ConfirmSheet` takes an optional `error` shown inside the confirmation.

### Verified
- jest 123/123 suites, 1390 tests. Typecheck and lint are clean.
- The Expo web build was driven at 360×740 and 320×568: avatar → sheet → Sign out → confirm → Not now → avatar reopens the sheet → Sign out lands on sign-in with nothing left on screen. **Not yet tried on a device**: that needs an EAS build under the team account.

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

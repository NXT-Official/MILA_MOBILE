#!/usr/bin/env bash
# Fails the build if a server-only secret name reaches the JavaScript bundle,
# or ever reached a commit. The mobile equivalent of the web's
# security-boundaries test.
set -euo pipefail

# The one definition, shared by both passes below — a name added here is
# checked in the shipped bundle AND across all of git history, and there is
# no second copy of the regex to let the two drift apart.
PATTERN='SERVICE_ROLE|AI_API_KEY|GEMINI_API_KEY|CLOUDFLARE_API_TOKEN|PADDLE_[A-Z_]*KEY|PADDLE_WEBHOOK|HCAPTCHA_SECRET'

OUT="${TMPDIR:-/tmp}/mila-bundle-scan"
rm -rf "$OUT"

echo "→ exporting Android bundle…"
npx expo export --platform android --output-dir "$OUT" >/dev/null

if grep -rlE "$PATTERN" "$OUT" 2>/dev/null; then
  echo "FAIL: a server-only secret name appears in the bundle (files listed above)."
  rm -rf "$OUT"
  exit 1
fi

echo "✓ no server-only secret names in the bundle"
rm -rf "$OUT"

echo "→ scanning git history for the same pattern…"

# `git log -p --all` walks every commit reachable from every ref (branches,
# tags), not just the current HEAD — a secret pushed on a branch that was
# later force-pushed away still lives in the underlying commit objects until
# they are actually pruned, and this is meant to catch exactly that.
#
# Two path classes are excluded, both because they legitimately spell out a
# secret's NAME (which is what $PATTERN matches) without ever holding its
# VALUE — the actual thing this scan exists to catch:
#   - This script itself. $PATTERN necessarily contains every name it looks
#     for, so every commit of this file matches itself.
#   - Markdown docs (`*.md`). §10 of docs/mobile-architecture.md documents
#     exactly which env var names must never ship client-side — that table
#     existing is the point, not a leak.
# Excluding two known, narrow path classes is a better fix than writing the
# pattern so obliquely that a future contributor cannot read it, and it does
# not weaken the check: a real secret *value* committed in a doc would still
# contain none of these bare names and would need its own detection anyway.
HISTORY_SCOPE=(-- . ':(exclude)scripts/scan-secrets.sh' ':(exclude)*.md')
if git log -p --all "${HISTORY_SCOPE[@]}" | grep -qE "$PATTERN"; then
  echo "FAIL: a server-only secret name appears somewhere in git history."
  echo "      Run: git log -p --all -- . ':(exclude)scripts/scan-secrets.sh' ':(exclude)*.md' | grep -E '$PATTERN'"
  echo "      to find the commit(s), then rotate the secret and scrub history."
  exit 1
fi

echo "✓ no server-only secret names in git history"

#!/usr/bin/env bash
# Fails the build if a server-only secret name reaches the JavaScript bundle.
# The mobile equivalent of the web's security-boundaries test.
set -euo pipefail

OUT="${TMPDIR:-/tmp}/mila-bundle-scan"
rm -rf "$OUT"

echo "→ exporting Android bundle…"
npx expo export --platform android --output-dir "$OUT" >/dev/null

PATTERN='SERVICE_ROLE|AI_API_KEY|GEMINI_API_KEY|CLOUDFLARE_API_TOKEN|PADDLE_[A-Z_]*KEY|PADDLE_WEBHOOK|HCAPTCHA_SECRET'

if grep -rlE "$PATTERN" "$OUT" 2>/dev/null; then
  echo "FAIL: a server-only secret name appears in the bundle (files listed above)."
  rm -rf "$OUT"
  exit 1
fi

echo "✓ no server-only secret names in the bundle"
rm -rf "$OUT"

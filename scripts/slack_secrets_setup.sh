#!/bin/bash
set -euo pipefail
# ──────────────────────────────────────────────────
# shinen-runner secret setup
# Writes tokens to ~/.config/stillframe/shinen-runner.env
# Values are NEVER echoed to the terminal.
# ──────────────────────────────────────────────────

ENV_DIR="$HOME/.config/stillframe"
ENV_FILE="$ENV_DIR/shinen-runner.env"

echo "=== shinen-runner secrets setup ==="
echo "Paste each token and press Enter. Input is hidden."
echo ""

read -s -r -p "SLACK_BOT_TOKEN  (xoxb-...): " BOT_TOKEN
echo ""
read -s -r -p "SLACK_APP_TOKEN  (xapp-...): " APP_TOKEN
echo ""
read -s -r -p "SLACK_SIGNING_SECRET:        " SIGNING_SECRET
echo ""

if [[ -z "$BOT_TOKEN" || -z "$APP_TOKEN" || -z "$SIGNING_SECRET" ]]; then
  echo "ERROR: all three values are required." >&2
  exit 1
fi

mkdir -p "$ENV_DIR"
chmod 700 "$ENV_DIR"

cat > "$ENV_FILE" <<EOF
SLACK_BOT_TOKEN=${BOT_TOKEN}
SLACK_APP_TOKEN=${APP_TOKEN}
SLACK_SIGNING_SECRET=${SIGNING_SECRET}
EOF
chmod 600 "$ENV_FILE"

echo ""
echo "✓ Secrets written to $ENV_FILE (chmod 600)"
echo "  Next: npm run slack:runner"

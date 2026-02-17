#!/bin/bash
set -euo pipefail
# ──────────────────────────────────────────────────
# Wrapper for launchd / manual start
# Sources env file → execs the Bolt runner
# ──────────────────────────────────────────────────

ENV_FILE="$HOME/.config/stillframe/shinen-runner.env"
ROOT="/Users/array0224/stillframe-phase0"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[shinen-runner] env file not found: $ENV_FILE" >&2
  echo "  Run: bash $ROOT/scripts/slack_secrets_setup.sh" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

cd "$ROOT"
exec npx tsx scripts/slack_runner.ts

#!/usr/bin/env bash
set -euo pipefail

# smoke.sh — Vercel deploy smoke test
# Usage: bash scripts/smoke.sh [URL]
# Default URL: production (stillframe-phase0.vercel.app)

URL="${1:-https://stillframe-phase0.vercel.app}"

status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL")

if [ "$status" = "200" ]; then
  echo "PASS  status=$status  url=$URL"
else
  echo "FAIL  status=$status  url=$URL"
  exit 1
fi

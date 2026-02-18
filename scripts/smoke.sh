#!/usr/bin/env bash
set -euo pipefail

# smoke.sh — deploy smoke + optional /api/version sha pin
# Usage:
#   bash scripts/smoke.sh [URL]
# Optional env:
#   EXPECTED_SHA   full or short sha; if set, /api/version sha must prefix-match
#   EXPECTED_ENV   vercelEnv expected value (e.g. production|preview)
#   MAX_ATTEMPTS   retry attempts (default: 10)
# Default URL: production (stillframe-phase0.vercel.app)

URL="${1:-https://stillframe-phase0.vercel.app}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
EXPECTED_ENV="${EXPECTED_ENV:-}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-10}"
EXPECTED_SHORT="${EXPECTED_SHA:0:7}"
DELAYS=(0.5 1 2 4 8 8 8 8 8 8)

if ! [[ "$MAX_ATTEMPTS" =~ ^[0-9]+$ ]] || [ "$MAX_ATTEMPTS" -lt 1 ]; then
  echo "FAIL  invalid MAX_ATTEMPTS=$MAX_ATTEMPTS"
  exit 1
fi

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  reason=""
  root_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$URL" || echo "000")"
  actual_short="-"
  actual_env="-"

  if [ "$root_status" != "200" ]; then
    reason="http_root_${root_status}"
  elif [ -n "$EXPECTED_SHA" ] || [ -n "$EXPECTED_ENV" ]; then
    version_json="$(curl -sS --max-time 10 "${URL%/}/api/version" || true)"
    if [ -z "$version_json" ]; then
      reason="http_version_failed"
    else
      if ! parsed="$(
        node -e '
          try {
            const j = JSON.parse(process.argv[1]);
            const sha = String(j.sha || "");
            const env = String(j.vercelEnv || "");
            process.stdout.write(`${sha}\n${env}`);
          } catch {
            process.exit(2);
          }
        ' "$version_json" 2>/dev/null
      )"; then
        reason="json_parse_failed"
      else
        actual_sha="$(printf '%s\n' "$parsed" | sed -n '1p')"
        actual_env="$(printf '%s\n' "$parsed" | sed -n '2p')"
        actual_short="${actual_sha:0:7}"

        if [ -n "$EXPECTED_SHA" ]; then
          if [ -z "$actual_sha" ] || [ "$actual_sha" = "unknown" ]; then
            reason="sha_missing_or_unknown"
          elif [[ "$actual_sha" != "$EXPECTED_SHORT"* ]]; then
            reason="sha_mismatch"
          fi
        fi
        if [ -z "$reason" ] && [ -n "$EXPECTED_ENV" ] && [ "$actual_env" != "$EXPECTED_ENV" ]; then
          reason="env_mismatch"
        fi
      fi
    fi
  fi

  echo "[attempt ${attempt}/${MAX_ATTEMPTS}] url=$URL root=$root_status expected=${EXPECTED_SHORT:-none} actual=${actual_short} env=${actual_env} reason=${reason:-ok}"

  if [ -z "$reason" ]; then
    echo "PASS  status=200  url=$URL sha=${actual_short} env=${actual_env:-n/a}"
    exit 0
  fi

  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    delay_idx=$((attempt - 1))
    delay="${DELAYS[$delay_idx]:-8}"
    sleep "$delay"
  fi
  attempt=$((attempt + 1))
done

echo "::error::DEPLOY_SMOKE_FAIL expected=${EXPECTED_SHORT:-none} actual=${actual_short} env=${actual_env} reason=${reason}"
exit 1

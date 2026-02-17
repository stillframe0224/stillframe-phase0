#!/usr/bin/env bash
# ============================================================
# market_pulse_smoke.sh — スモークテスト
# 使い方: bash scripts/market_pulse_smoke.sh
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Market Pulse Smoke Test ==="
echo "Repo: $REPO_ROOT"
echo ""

# 1. npm ci
echo "[1/4] npm ci..."
npm ci --silent
echo "  OK"

# 2. build
echo "[2/4] Building..."
npm run market:pulse:build 2>&1
echo "  OK"

# 3. dry-run (ファイル書き込みなし)
echo "[3/4] Running --dry-run..."
npm run market:pulse -- --dry-run --limit 5
echo "  OK"

# 4. 実際に実行して出力ファイルを確認
echo "[4/4] Running (actual write)..."
npm run market:pulse -- --limit 5

DATE=$(date +"%Y-%m-%d")
REPORT="reports/market_pulse/${DATE}.md"
CANDIDATES="reports/market_pulse/candidates.json"
RAW="reports/market_pulse/raw.jsonl"

echo ""
echo "=== Checking output files ==="

if [ -f "$REPORT" ]; then
  echo "  OK $REPORT ($(wc -l < "$REPORT") lines)"
else
  echo "  FAIL: $REPORT not found!"
  exit 1
fi

if [ -f "$CANDIDATES" ]; then
  COUNT=$(python3 -c "import json; d=json.load(open('$CANDIDATES')); print(len(d))" 2>/dev/null || echo "?")
  echo "  OK $CANDIDATES ($COUNT candidates)"
else
  echo "  FAIL: $CANDIDATES not found!"
  exit 1
fi

if [ -f "$RAW" ]; then
  LINES=$(wc -l < "$RAW")
  echo "  OK $RAW ($LINES lines)"
else
  echo "  WARN: $RAW not found (may be OK if no items)"
fi

ISSUES_DIR="issues/auto_generated/${DATE}"
if [ -d "$ISSUES_DIR" ]; then
  COUNT=$(ls "$ISSUES_DIR"/*.md 2>/dev/null | wc -l || echo 0)
  echo "  OK $ISSUES_DIR ($COUNT drafts)"
else
  echo "  INFO: $ISSUES_DIR not created (may be OK if no high-score items)"
fi

echo ""
echo "=== Smoke test PASSED ==="

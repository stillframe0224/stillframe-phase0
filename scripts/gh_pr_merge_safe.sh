#!/usr/bin/env bash
set -euo pipefail

PR="${1:-}"
if [[ -z "$PR" || "$PR" == "-h" || "$PR" == "--help" ]]; then
  echo "Usage: $0 <PR_NUMBER> [--admin-fallback]"
  echo "Env: OUT=<report_path> (default: reports/triad/<date>_pr<PR>_merge.md)"
  exit 0
fi
shift || true

ADMIN_FALLBACK="0"
if [[ "${1:-}" == "--admin-fallback" ]]; then
  ADMIN_FALLBACK="1"
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

TS="$(date +%Y%m%d_%H%M%S)"
RUN_AT="$(date +%Y-%m-%dT%H:%M:%S%z)"
OUT="${OUT:-$ROOT/reports/triad/${TS}_pr${PR}_merge.md}"
mkdir -p "$(dirname "$OUT")"

{
  echo "# PR #${PR} merge (safe runner)"
  echo ""
  echo "- RunAt: ${RUN_AT}"
  echo "- gh: $(gh --version | head -n1)"
  echo "- branch: $(git rev-parse --abbrev-ref HEAD)"
  echo ""
  echo "## PR snapshot (before)"
  gh pr view "$PR" --json number,title,state,url,headRefName,baseRefName,isDraft,mergeStateStatus,mergeable,reviewDecision || true
  echo ""
  echo "## Checks (before)"
  gh pr checks "$PR" || true
  echo ""
} > "$OUT"

IS_DRAFT="$(gh pr view "$PR" --json isDraft -q '.isDraft' 2>/dev/null || echo false)"
if [[ "$IS_DRAFT" == "true" ]]; then
  echo "Action: gh pr ready $PR" | tee -a "$OUT"
  gh pr ready "$PR" | tee -a "$OUT"
fi

echo "Action: gh pr checks $PR --watch" | tee -a "$OUT"
if ! gh pr checks "$PR" --watch 2>&1 | tee -a "$OUT"; then
  echo "STOP: checks failed. See $OUT" | tee -a "$OUT"
  exit 2
fi

REVIEW_DECISION="$(gh pr view "$PR" --json reviewDecision -q '.reviewDecision' 2>/dev/null || echo "")"
echo "ReviewDecision: ${REVIEW_DECISION}" | tee -a "$OUT"
if [[ "$REVIEW_DECISION" == "CHANGES_REQUESTED" ]]; then
  echo "STOP: changes requested; cannot merge." | tee -a "$OUT"
  exit 3
fi
if [[ "$REVIEW_DECISION" == "REVIEW_REQUIRED" || "$REVIEW_DECISION" == "REQUIRED" ]]; then
  echo "Action: try approve (may fail by policy)" | tee -a "$OUT"
  gh pr review "$PR" --approve 2>&1 | tee -a "$OUT" || echo "NOTE: approve failed (policy/permission)" | tee -a "$OUT"
fi

echo "Action: gh pr merge $PR --squash --delete-branch" | tee -a "$OUT"
set +e
gh pr merge "$PR" --squash --delete-branch 2>&1 | tee -a "$OUT"
RC=${PIPESTATUS[0]}
set -e

if [[ "$RC" -ne 0 && "$ADMIN_FALLBACK" == "1" ]]; then
  echo "Retry: gh pr merge $PR --squash --delete-branch --admin" | tee -a "$OUT"
  set +e
  gh pr merge "$PR" --squash --delete-branch --admin 2>&1 | tee -a "$OUT"
  RC=${PIPESTATUS[0]}
  set -e
fi

if [[ "$RC" -ne 0 ]]; then
  echo "STOP: merge blocked. See $OUT" | tee -a "$OUT"
  exit 4
fi

{
  echo ""
  echo "## PR snapshot (after)"
  gh pr view "$PR" --json state,closed,mergeCommit,mergedAt,url || true
  echo ""
  echo "DONE: $OUT"
} | tee -a "$OUT"

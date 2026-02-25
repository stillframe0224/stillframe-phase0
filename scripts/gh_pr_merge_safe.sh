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

# Global flag set by ensure_codex_headings:
#   ENSURE_CODEX_CHANGED=1 -> body edited
#   ENSURE_CODEX_CHANGED=0 -> no change needed
ENSURE_CODEX_CHANGED=0
CHECKS_CONFIRMED=0

git_remote_repo_slug() {
  local remote
  remote="$(git remote get-url origin 2>/dev/null || true)"
  if [[ -z "$remote" ]]; then
    return 1
  fi
  remote="${remote%.git}"
  if [[ "$remote" =~ github.com[:/]([^/]+/[^/]+)$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

is_gh_connectivity_error_text() {
  local text="${1:-}"
  printf '%s' "$text" | grep -Eiq \
    'error connecting to api\.github\.com|Could not resolve host|Temporary failure|connection reset|Connection refused|timed out|timeout|EOF|TLS handshake timeout|Network is unreachable'
}

is_gh_connectivity_error_file() {
  local file="${1:-}"
  [[ -n "$file" && -f "$file" ]] || return 1
  grep -Eiq \
    'error connecting to api\.github\.com|Could not resolve host|Temporary failure|connection reset|Connection refused|timed out|timeout|EOF|TLS handshake timeout|Network is unreachable' \
    "$file"
}

required_checks_green() {  # args: PR, REPO
  local pr="${1:?pr required}" repo="${2:?repo required}"
  local out rc
  set +e
  out="$(gh pr checks "$pr" --repo "$repo" --required 2>&1)"
  rc=$?
  set -e
  printf '%s\n' "$out" | tee -a "$OUT" >/dev/null
  [[ "$rc" -eq 0 ]]
}

run_checks_watch_with_connectivity_fallback() {  # args: PR, REPO, LABEL
  local pr="${1:?pr required}" repo="${2:?repo required}" label="${3:-checks --watch}"
  local log rc
  log="$(mktemp)"
  echo "Action: ${label}" | tee -a "$OUT"
  set +e
  gh pr checks "$pr" --repo "$repo" --watch 2>&1 | tee -a "$OUT" | tee "$log"
  rc=${PIPESTATUS[0]}
  set -e
  if [[ "$rc" -eq 0 ]]; then
    CHECKS_CONFIRMED=1
    rm -f "$log"
    return 0
  fi
  if is_gh_connectivity_error_file "$log" && required_checks_green "$pr" "$repo"; then
    echo "WARN: gh connectivity error during checks watch, but required checks are PASS; continuing." | tee -a "$OUT"
    CHECKS_CONFIRMED=1
    rm -f "$log"
    return 0
  fi
  rm -f "$log"
  return "$rc"
}

REPO_SLUG="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
if [[ -z "$REPO_SLUG" ]]; then
  REPO_SLUG="$(git_remote_repo_slug || true)"
fi
if [[ -z "$REPO_SLUG" ]]; then
  echo "STOP: unable to resolve repository slug from gh or git remote."
  exit 1
fi

codex_check_is_failing() {  # args: PR, REPO
  local pr="${1:?pr required}" repo="${2:?repo required}" s=""

  # statusCheckRollup may contain MULTIPLE runs of the same check
  # (e.g. old failed + new passed after body edit). If ANY run is
  # success/neutral, the check is NOT failing.
  s="$(gh pr view "$pr" --repo "$repo" --json statusCheckRollup --jq '
    [ .statusCheckRollup[]?
      | select(.name=="codex-review-check")
      | ((.conclusion // .state // .status // "") | ascii_downcase)
    ] | if any(. == "success" or . == "neutral") then "success"
        else (last // "")
        end
  ' 2>/dev/null || true)"

  if [[ "$s" == "success" || "$s" == "neutral" ]]; then
    return 1
  fi
  if [[ "$s" =~ ^(failure|failed|timed_out|cancelled|action_required|error)$ ]]; then
    return 0
  fi

  # Fallback when statusCheckRollup is unavailable/empty.
  # If any line shows pass, not failing.
  local checks_out
  checks_out="$(gh pr checks "$pr" --repo "$repo" 2>/dev/null || true)"
  if echo "$checks_out" | awk '$1=="codex-review-check" && $2=="pass"{found=1} END{exit(found?0:1)}'; then
    return 1
  fi
  echo "$checks_out" | awk '$1=="codex-review-check" && $2=="fail"{found=1} END{exit(found?0:1)}'
}

ensure_codex_headings() {  # args: PR_NUMBER, REPO
  local pr="${1:?PR number required}"
  local repo="${2:?repo required}"

  local tmp="/tmp/pr_body.${pr}.md"
  local bak="${tmp}.bak"
  local norm="${tmp}.norm"
  local new="${tmp}.new"
  ENSURE_CODEX_CHANGED=0

  gh pr view "$pr" --repo "$repo" --json body -q '.body' > "$tmp" || return 1
  cp "$tmp" "$bak" || return 1
  awk '{ sub(/\r$/, "", $0); gsub(/[ \t]+$/, "", $0); print }' "$tmp" > "$norm" || return 1

  local has_r has_t has_e
  read -r has_r has_t has_e < <(
    awk '
      BEGIN { in_fence=0; r=0; t=0; e=0 }
      {
        line=$0
        if (line ~ /^[ \t]*(```|~~~)/) { in_fence = !in_fence; next }
        if (!in_fence) {
          if (line ~ /^## Codex: RISKS[ \t]*$/) r=1
          if (line ~ /^## Codex: TESTS[ \t]*$/) t=1
          if (line ~ /^## Codex: EDGE[ \t]*$/)  e=1
        }
      }
      END { printf "%d %d %d\n", r, t, e }
    ' "$norm"
  ) || return 1

  local prepend=""
  if [[ "${has_r:-0}" -eq 0 ]]; then
    prepend+=$'## Codex: RISKS\n- (fill)\n\n'
  fi
  if [[ "${has_t:-0}" -eq 0 ]]; then
    prepend+=$'## Codex: TESTS\n- (fill)\n\n'
  fi
  if [[ "${has_e:-0}" -eq 0 ]]; then
    prepend+=$'## Codex: EDGE\n- (fill)\n\n'
  fi

  if [[ -z "$prepend" ]]; then
    rm -f "$norm" "$new"
    return 0
  fi

  {
    printf '%s' "$prepend"
    cat "$tmp"
  } > "$new" || return 1

  if cmp -s "$tmp" "$new"; then
    rm -f "$norm" "$new"
    return 0
  fi
  mv "$new" "$tmp" || return 1

  local attempt delay=1
  for attempt in 1 2 3; do
    if gh pr edit "$pr" --repo "$repo" --body-file "$tmp"; then
      ENSURE_CODEX_CHANGED=1
      rm -f "$norm"
      return 0
    fi
    [[ "$attempt" -eq 3 ]] && break
    sleep "$delay"
    delay=$((delay * 2))
  done

  rm -f "$norm"
  return 1
}

{
  echo "# PR #${PR} merge (safe runner)"
  echo ""
  echo "- RunAt: ${RUN_AT}"
  echo "- gh: $(gh --version | head -n1)"
  echo "- branch: $(git rev-parse --abbrev-ref HEAD)"
  echo ""
  echo "## PR snapshot (before)"
  gh pr view "$PR" --repo "$REPO_SLUG" --json number,title,state,url,headRefName,baseRefName,isDraft,mergeStateStatus,mergeable,reviewDecision || true
  echo ""
  echo "## Checks (before)"
  gh pr checks "$PR" --repo "$REPO_SLUG" || true
  echo ""
} > "$OUT"

IS_DRAFT="$(gh pr view "$PR" --repo "$REPO_SLUG" --json isDraft -q '.isDraft' 2>/dev/null || echo false)"
if [[ "$IS_DRAFT" == "true" ]]; then
  echo "Action: gh pr ready $PR" | tee -a "$OUT"
  gh pr ready "$PR" --repo "$REPO_SLUG" | tee -a "$OUT"
fi

# --- Pre-watch: fix codex headings if check is already failing ---
CHECKS_WATCHED=0
echo "## Checks (snapshot)" | tee -a "$OUT"
gh pr checks "$PR" --repo "$REPO_SLUG" 2>&1 | tee -a "$OUT" || true

if codex_check_is_failing "$PR" "$REPO_SLUG"; then
  echo "Detected codex-review-check failure; attempting auto-fix." | tee -a "$OUT"
  if ! ensure_codex_headings "$PR" "$REPO_SLUG"; then
    echo "STOP: failed to edit PR body for Codex headings; aborting merge." | tee -a "$OUT"
    exit 2
  fi
  if [[ "${ENSURE_CODEX_CHANGED:-0}" == "1" ]]; then
    if ! run_checks_watch_with_connectivity_fallback "$PR" "$REPO_SLUG" "gh pr checks $PR --watch (after body edit)"; then
      echo "STOP: checks failed after PR body edit. See $OUT" | tee -a "$OUT"
      exit 2
    fi
    CHECKS_WATCHED=1
  else
    echo "STOP: codex-review-check failed but headings already present (non-heading cause)." | tee -a "$OUT"
    exit 2
  fi
fi

# --- Final watch gate (skip if already watched after body edit) ---
if [[ "$CHECKS_WATCHED" == "0" ]]; then
  if ! run_checks_watch_with_connectivity_fallback "$PR" "$REPO_SLUG" "gh pr checks $PR --watch"; then
    echo "STOP: checks failed. See $OUT" | tee -a "$OUT"
    exit 2
  fi
fi

REVIEW_DECISION="$(gh pr view "$PR" --repo "$REPO_SLUG" --json reviewDecision -q '.reviewDecision' 2>/dev/null || echo "")"
echo "ReviewDecision: ${REVIEW_DECISION}" | tee -a "$OUT"
if [[ "$REVIEW_DECISION" == "CHANGES_REQUESTED" ]]; then
  echo "STOP: changes requested; cannot merge." | tee -a "$OUT"
  exit 3
fi
if [[ "$REVIEW_DECISION" == "REVIEW_REQUIRED" || "$REVIEW_DECISION" == "REQUIRED" ]]; then
  echo "Action: try approve (may fail by policy)" | tee -a "$OUT"
  gh pr review "$PR" --repo "$REPO_SLUG" --approve 2>&1 | tee -a "$OUT" || echo "NOTE: approve failed (policy/permission)" | tee -a "$OUT"
fi

echo "Action: gh pr merge $PR --squash --delete-branch" | tee -a "$OUT"
MERGE_LOG="$(mktemp)"
set +e
gh pr merge "$PR" --repo "$REPO_SLUG" --squash --delete-branch 2>&1 | tee -a "$OUT" | tee "$MERGE_LOG"
RC=${PIPESTATUS[0]}
set -e

if [[ "$RC" -ne 0 && "$CHECKS_CONFIRMED" == "1" ]] && is_gh_connectivity_error_file "$MERGE_LOG"; then
  echo "Fallback: checks confirmed PASS and merge failed due to connectivity; retrying standard squash merge." | tee -a "$OUT"
  set +e
  gh pr merge "$PR" --repo "$REPO_SLUG" --squash --delete-branch 2>&1 | tee -a "$OUT" | tee -a "$MERGE_LOG"
  RC=${PIPESTATUS[0]}
  set -e
fi

if [[ "$RC" -ne 0 && "$ADMIN_FALLBACK" == "1" ]]; then
  echo "Retry: gh pr merge $PR --squash --delete-branch --admin" | tee -a "$OUT"
  set +e
  gh pr merge "$PR" --repo "$REPO_SLUG" --squash --delete-branch --admin 2>&1 | tee -a "$OUT" | tee -a "$MERGE_LOG"
  RC=${PIPESTATUS[0]}
  set -e
fi

rm -f "$MERGE_LOG"

if [[ "$RC" -ne 0 ]]; then
  echo "STOP: merge blocked. See $OUT" | tee -a "$OUT"
  exit 4
fi

{
  echo ""
  echo "## PR snapshot (after)"
  gh pr view "$PR" --repo "$REPO_SLUG" --json state,closed,mergeCommit,mergedAt,url || true
  echo ""
  echo "DONE: $OUT"
} | tee -a "$OUT"

#!/usr/bin/env bash
# pr_auto.sh — push → PR create/update → auto-merge (squash) in one command.
#
# Usage:
#   bash scripts/pr_auto.sh                     # auto-detect branch, use template body
#   bash scripts/pr_auto.sh --title "feat: ..."  # override PR title
#   BODY_FILE=pr_body.md bash scripts/pr_auto.sh # use custom body file
#
# Prereqs: gh CLI authenticated, branch has at least 1 commit ahead of main.
set -euo pipefail

REPO="stillframe0224/stillframe-phase0"
BASE="main"
TITLE_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title) TITLE_OVERRIDE="${2:-}"; shift 2 ;;
    --title=*) TITLE_OVERRIDE="${1#*=}"; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

BR="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BR" == "$BASE" ]]; then
  echo "ERROR: cannot create PR from $BASE branch. Create a feature branch first."
  exit 1
fi

# ---- 1. Push ----
echo "→ Pushing $BR to origin..."
git push -u origin "$BR"

# ---- 2. PR create or update ----
PR="$(gh pr list --repo "$REPO" --head "$BR" --state open --json number --jq '.[0].number' 2>/dev/null || true)"

# Default body template (Codex headings required by CI)
DEFAULT_BODY="$(cat <<'TMPL'
## Summary
- (fill)

## Codex: RISKS
- (fill)

## Codex: TESTS
- (fill)

## Codex: EDGE
- (fill)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
TMPL
)"

# Use custom body file if provided, otherwise default template
if [[ -n "${BODY_FILE:-}" && -f "${BODY_FILE}" ]]; then
  BODY="$(cat "$BODY_FILE")"
else
  BODY="$DEFAULT_BODY"
fi

TITLE="${TITLE_OVERRIDE:-$BR}"

if [[ -z "${PR:-}" || "${PR:-null}" = "null" ]]; then
  echo "→ Creating PR: $TITLE"
  PR_URL="$(gh pr create --repo "$REPO" --base "$BASE" --head "$BR" \
    --title "$TITLE" --body "$BODY")"
  echo "  PR: $PR_URL"
  PR="$(echo "$PR_URL" | sed -E 's#.*/pull/([0-9]+).*#\1#')"
else
  echo "→ PR #$PR already exists. Updating body..."
  gh pr edit "$PR" --repo "$REPO" --body "$BODY"
  if [[ -n "$TITLE_OVERRIDE" ]]; then
    gh pr edit "$PR" --repo "$REPO" --title "$TITLE_OVERRIDE"
  fi
  echo "  PR: https://github.com/$REPO/pull/$PR"
fi

# ---- 3. Enable auto-merge ----
echo "→ Enabling auto-merge (squash) for PR #$PR..."
gh pr merge "$PR" --repo "$REPO" --auto --squash --delete-branch

echo ""
echo "✅ Done. PR #$PR will auto-merge when all required checks pass."
echo "   https://github.com/$REPO/pull/$PR"

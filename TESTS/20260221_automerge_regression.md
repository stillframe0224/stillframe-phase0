# TESTS — automerge-safe regression (minimal) (2026-02-21)

## Preconditions

```bash
REPO=stillframe0224/stillframe-phase0
```

## 1) Kill switch OFF/ON works

### OFF path (disable automerge globally)

```bash
# Set repo variable OFF=1 (requires repo admin/maintainer permission)
gh variable set AUTOMERGE_GLOBAL_OFF --repo "$REPO" --body "1"

# Trigger a workflow run by re-running latest automerge-safe
RUN_ID=$(gh run list --repo "$REPO" --workflow automerge_safe.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run rerun "$RUN_ID" --repo "$REPO"

# Confirm summary/log contains DISABLED
gh run watch "$RUN_ID" --repo "$REPO"
gh run view "$RUN_ID" --repo "$REPO" --log | rg -n "DISABLED|AUTOMERGE_GLOBAL_OFF"
```

### ON path (re-enable)

```bash
gh variable set AUTOMERGE_GLOBAL_OFF --repo "$REPO" --body "0"
```

## 2) Canary docs-only PR auto-merges (`allow_auto_merge=false` path included)

```bash
# Create throwaway docs-only branch
git checkout -b docs/canary-automerge-$(date +%Y%m%d%H%M%S)
echo "canary $(date -u +%FT%TZ)" >> docs/automerge_canary.md
git add docs/automerge_canary.md
git commit -m "docs: automerge canary"
git push -u origin HEAD

# Create PR with required headings
cat > /tmp/pr_body_canary.md <<'MD'
## Summary
- docs-only canary for automerge-safe

## Codex: RISKS
- low

## Codex: TESTS
- canary only

## Codex: EDGE
- none
MD

gh pr create --repo "$REPO" --base main --head "$(git branch --show-current)" --title "docs: automerge canary" --body-file /tmp/pr_body_canary.md

# Observe merge path
gh pr checks --repo "$REPO" --watch
PR=$(gh pr list --repo "$REPO" --head "$(git branch --show-current)" --json number --jq '.[0].number')
gh pr view "$PR" --repo "$REPO" --json state,mergedAt,mergeStateStatus,url --jq '{state,mergedAt,mergeStateStatus,url}'
```

## 3) Deny path: PR touching `.github/workflows/**` stays unmerged

```bash
git checkout -b docs/deny-workflow-touch-$(date +%Y%m%d%H%M%S)
echo "# deny canary" >> .github/workflows/_deny_canary.tmp
git add .github/workflows/_deny_canary.tmp
git commit -m "test: deny path workflow touch"
git push -u origin HEAD

cat > /tmp/pr_body_deny.md <<'MD'
## Summary
- deny-path check

## Codex: RISKS
- low

## Codex: TESTS
- deny path

## Codex: EDGE
- none
MD

gh pr create --repo "$REPO" --base main --head "$(git branch --show-current)" --title "test: deny workflow-touch" --body-file /tmp/pr_body_deny.md
PR=$(gh pr list --repo "$REPO" --head "$(git branch --show-current)" --json number --jq '.[0].number')

# Wait for automerge-safe classification and verify unmerged
gh pr checks "$PR" --repo "$REPO" --watch || true
gh pr view "$PR" --repo "$REPO" --json state,mergeStateStatus,labels,url --jq '{state,mergeStateStatus,labels:[.labels[].name],url}'
```

## 4) Sweeper correctness: label-gated + CLEAN-only (observe without waiting 1h)

```bash
# Force re-run latest automerge-safe workflow to simulate sweeper observation window
RUN_ID=$(gh run list --repo "$REPO" --workflow automerge_safe.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run rerun "$RUN_ID" --repo "$REPO"
gh run watch "$RUN_ID" --repo "$REPO"

# Check sweep summary details in log
gh run view "$RUN_ID" --repo "$REPO" --log | rg -n "sweep|automerge:eligible|state=|merged|skipped"
```

Expected:
- only `automerge:eligible` open PRs are considered by sweep
- non-`clean` PRs are skipped
- drafts/forks/`automerge:off` are skipped

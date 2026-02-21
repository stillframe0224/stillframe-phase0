# TESTS — automerge-safe minimal regression (2026-02-21)

## Preconditions

```bash
REPO=stillframe0224/stillframe-phase0
```

## 1) Kill switch ON/OFF

```bash
# ON
gh variable set AUTOMERGE_GLOBAL_OFF --repo "$REPO" --body "1"
RUN_ID=$(gh run list --repo "$REPO" --workflow automerge_safe.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run rerun "$RUN_ID" --repo "$REPO"
gh run watch "$RUN_ID" --repo "$REPO"
gh run view "$RUN_ID" --repo "$REPO" --log | rg -n "DISABLED|AUTOMERGE_GLOBAL_OFF"

# OFF
gh variable set AUTOMERGE_GLOBAL_OFF --repo "$REPO" --body "0"
```

## 2) Docs-only PR auto-merges (`allow_auto_merge=false` path included)

```bash
git checkout -b docs/canary-automerge-$(date +%Y%m%d%H%M%S)
echo "canary $(date -u +%FT%TZ)" >> docs/automerge_canary.md
git add docs/automerge_canary.md
git commit -m "docs: automerge canary"
git push -u origin HEAD

cat > /tmp/pr_body_canary.md <<'MD'
## Summary
- docs-only canary for automerge-safe

## Codex: RISKS
- low

## Codex: TESTS
- canary

## Codex: EDGE
- none
MD

gh pr create --repo "$REPO" --base main --head "$(git branch --show-current)" --title "docs: automerge canary" --body-file /tmp/pr_body_canary.md
PR=$(gh pr list --repo "$REPO" --head "$(git branch --show-current)" --json number --jq '.[0].number')
gh pr checks "$PR" --repo "$REPO" --watch
gh pr view "$PR" --repo "$REPO" --json state,mergedAt,mergeStateStatus,url --jq '{state,mergedAt,mergeStateStatus,url}'
```

## 3) Deny path: touching `.github/workflows/**` must NOT auto-merge

```bash
git checkout -b docs/deny-workflow-touch-$(date +%Y%m%d%H%M%S)
echo "# deny canary" >> .github/workflows/_deny_canary.tmp
git add .github/workflows/_deny_canary.tmp
git commit -m "test: deny path workflow touch"
git push -u origin HEAD

cat > /tmp/pr_body_deny.md <<'MD'
## Summary
- deny path check

## Codex: RISKS
- low

## Codex: TESTS
- deny path

## Codex: EDGE
- none
MD

gh pr create --repo "$REPO" --base main --head "$(git branch --show-current)" --title "test: deny workflow-touch" --body-file /tmp/pr_body_deny.md
PR=$(gh pr list --repo "$REPO" --head "$(git branch --show-current)" --json number --jq '.[0].number')
gh pr checks "$PR" --repo "$REPO" --watch || true
gh pr view "$PR" --repo "$REPO" --json state,mergeStateStatus,labels,url --jq '{state,mergeStateStatus,labels:[.labels[].name],url}'
```

## 4) Sweeper behavior (label-gated + allowlist revalidation + CLEAN-only)

```bash
RUN_ID=$(gh run list --repo "$REPO" --workflow automerge_safe.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run rerun "$RUN_ID" --repo "$REPO"
gh run watch "$RUN_ID" --repo "$REPO"
gh run view "$RUN_ID" --repo "$REPO" --log | rg -n "sweep|automerge:eligible|state=|merged|skipped|not allowed|denied"
```

Expected:
- Only `automerge:eligible` open PRs are considered.
- Files are revalidated against deny/allow rules before merge.
- Only CLEAN state is merged.

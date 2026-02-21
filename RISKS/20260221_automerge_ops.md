# RISKS — automerge-safe operations audit (2026-02-21)

## Scope Baseline
- Memory baseline: **Claude Code built-in memory (Auto memory + `CLAUDE.md`)**.
- `claude-mem` plugin is **optional** and not required for this operating model.

## Top Risks

1. **Unintended merges**
- Trigger overlap (`pull_request` + `workflow_run` + hourly sweep) can merge docs PRs quickly once eligible.

2. **Label misuse**
- Manual edits to `automerge:eligible` / `automerge:off` can cause unexpected merge/skip behavior.

3. **Workflow name drift (`workflow_run`)**
- If upstream workflow names change (`e2e`, `stage3`, `deploy-smoke`, `ui-smoke`), retry path can silently stop.

4. **Fork PR handling risk**
- If fork checks are weakened, automation could act on untrusted branch context.

5. **Pagination risk (>100 files)**
- Mis-implemented file listing can misclassify large PRs.

6. **External check timing gaps**
- Vercel/external checks can be green after internal checks; merge timing can appear inconsistent.

7. **Global kill switch misuse**
- Setting `AUTOMERGE_GLOBAL_OFF` incorrectly (or forgetting to revert) causes prolonged stale queue or accidental run.

## Existing Mitigations (present now)
- Allow/deny classification with deny-first rules.
- CLEAN-only merge path when repo `allow_auto_merge=false`.
- `workflow_run` success retry path.
- Hourly sweeper (`schedule`).
- Global kill switch gate (`AUTOMERGE_GLOBAL_OFF`).
- No-admin merge policy (no force-admin fallback).
- Same-repo only + draft/fork skip checks.

## Residual Risk
- Operational mistakes (labels/settings/workflow names) can still bypass intent before humans notice.

## Single Best Operational Rule

### Kill switch first (mandatory incident procedure)
1. Set `AUTOMERGE_GLOBAL_OFF=1` immediately.
2. Verify `automerge-safe` summary shows **DISABLED**.
3. Investigate labels / workflow names / repo settings.
4. Only then set `AUTOMERGE_GLOBAL_OFF=0`.

## Verification Commands

```bash
REPO=stillframe0224/stillframe-phase0

# Kill switch value (repo variable)
gh variable list --repo "$REPO" | rg AUTOMERGE_GLOBAL_OFF

# Latest automerge-safe runs
gh run list --repo "$REPO" --workflow automerge_safe.yml --limit 10

# Inspect latest run log for gate behavior
RUN_ID=$(gh run list --repo "$REPO" --workflow automerge_safe.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view "$RUN_ID" --repo "$REPO" --log | rg -n "DISABLED|AUTOMERGE_GLOBAL_OFF|Eligible|Reason"

# Repo auto-merge setting
gh api "repos/$REPO" --jq '{allow_auto_merge,default_branch}'
```

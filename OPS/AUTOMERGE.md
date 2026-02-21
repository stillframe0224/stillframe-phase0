# Automerge — Safe-Only (Phase 1)

Workflow: `.github/workflows/automerge_safe.yml`

## Overview

Automatically merges LOW-RISK pull requests that touch only documentation, ops configs, and style files. Designed to be safe-by-default: if uncertain, it does nothing.

## Allowlist (files that CAN be auto-merged)

| Pattern | Examples |
|---------|----------|
| `docs/**` | Any file under docs/ |
| `ops/**` | Ops runbooks, guides |
| `.github/**` (except workflows) | PR templates, issue templates, CODEOWNERS |
| `**/*.md` | README, CHANGELOG, etc. |
| `**/*.txt` | License, notices |
| `**/*.css` | Stylesheets (no logic) |

## Denylist (files that BLOCK auto-merge)

| Pattern | Reason |
|---------|--------|
| `.github/workflows/**` | CI/CD changes require human review |
| `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` | Dependency changes |
| `app/**` | Application source code |
| `lib/**` | Shared library code |
| `scripts/**` | Build/deploy scripts |
| `api/**` | API routes |

If ANY changed file matches the denylist, the entire PR is ineligible.
If ANY changed file is not in the allowlist, the PR is ineligible.

## Kill Switches

### Per-PR
1. **Label**: Add `automerge:off` to the PR → automerge is skipped.
2. **Title token**: Include `[NO-AUTOMERGE]` in the PR title → automerge is skipped.

Both are checked before file classification.

### Global (repository variable)
3. **`AUTOMERGE_GLOBAL_OFF`**: Set to `"1"` → ALL automerge paths are disabled (PR-triggered, workflow_run retry, hourly sweeper). Jobs still pass (non-blocking) but skip all mutating actions and write "DISABLED" to step summary.

**Disable** (stop all automerge immediately):
```bash
gh variable set AUTOMERGE_GLOBAL_OFF --repo stillframe0224/stillframe-phase0 --body "1"
```

**Re-enable** (either set to `"0"` or delete):
```bash
gh variable set AUTOMERGE_GLOBAL_OFF --repo stillframe0224/stillframe-phase0 --body "0"
# or
gh variable delete AUTOMERGE_GLOBAL_OFF --repo stillframe0224/stillframe-phase0
```

The gate is evaluated at job start via `${{ vars.AUTOMERGE_GLOBAL_OFF == '1' }}`. When absent or any value other than `"1"`, automerge is enabled.

## Merge Behavior

### When repo has `allow_auto_merge` enabled
- Uses `gh pr merge --auto --squash --delete-branch`
- GitHub queues the merge and waits for all required checks to pass.

### When `allow_auto_merge` is NOT enabled
- Checks `mergeStateStatus` via the API.
- Only merges if status is `CLEAN` (all checks passed, no conflicts).
- If checks are pending or failing, does nothing and exits cleanly.
- Re-evaluates automatically when required-check workflows complete (via `workflow_run` trigger).

### Retry mechanism
- Retry is driven by `workflow_run(completed)` of the required workflows: `e2e`, `stage3`, `deploy-smoke`, `ui-smoke`.
- When any of these workflows completes successfully on a `pull_request` event, automerge-safe re-runs and checks if the PR is now CLEAN.
- `check_suite`/`check_run` triggers are NOT used due to GitHub Actions recursion prevention constraints.
- No polling or sleep loops — purely event-driven.

### Hourly sweeper (`sweep-eligible` job)
- Schedule: `cron: '17 * * * *'` (every hour at :17).
- Lists all open PRs with the `automerge:eligible` label.
- For each candidate: re-validates safety checks, kill switches, allowlist/denylist, then checks `mergeable_state`.
- Merges (squash + delete branch) if state is `clean`; skips otherwise.
- Writes a summary table to `$GITHUB_STEP_SUMMARY` with candidates/merged/skipped/failed counts.
- Acts as a safety net for edge cases where `workflow_run` events are missed or delayed.

### Hard gate: REQUIRED_CHECKS must be COMPLETED+SUCCESS

Before any merge attempt (PR-triggered, workflow_run retry, and hourly sweeper), the workflow queries the PR's head commit via GraphQL `statusCheckRollup` and verifies that **every** check listed in the workflow-level `REQUIRED_CHECKS` env is `COMPLETED`+`SUCCESS`.

If any required check is missing, pending, in-progress, or failed, the merge is blocked — regardless of `mergeStateStatus`.

**Why**: GitHub's `mergeStateStatus=CLEAN` can briefly return true during a `gh run rerun` transition (the old run is invalidated but the new one hasn't reported yet). This hard gate closes that race window.

**REQUIRED_CHECKS** (single source of truth in `automerge_safe.yml`):
```
audit, build, guard, smoke, ui-smoke, deploy-smoke, codex-review-check, codex-headings-unit
```

**Job-name uniqueness requirement**: Each required check name must be globally unique across all workflow files. If a check is renamed, the `REQUIRED_CHECKS` list must be updated.

### Safety guarantees
- **Never uses `--admin`** — respects branch protection and merge queues.
- **Never bypasses required checks** — hard-gates on GraphQL statusCheckRollup before merge.
- **Event-driven + hourly sweep** — no busy-polling or sleep loops.
- **Never uses `pull_request_target`** — no elevated permissions from forks.
- **Fork PRs are skipped entirely.**
- **Draft PRs are skipped entirely.**
- **On any merge failure, exits 0** — non-blocking, no fallback escalation.
- **Sweeper re-validates** — never trusts stale `automerge:eligible` labels; always re-checks files.

## Auditing

- **Label**: Eligible PRs get the `automerge:eligible` label (neutral green).
- **Job summary**: Every run writes a classification table to the GitHub Actions summary, including eligibility, reason, and changed file list.
- **Workflow logs**: Standard GitHub Actions logs for full traceability.

## Phase 1 Limitations

- `.github/workflows/**` changes are NEVER auto-merged.
- Application code (`app/`, `lib/`, `scripts/`, `api/`) is NEVER auto-merged.
- Lock files are NEVER auto-merged.
- Only `squash` merge strategy is used.

# Triad Report: Automerge Retry via workflow_run

**Date**: 2026-02-20
**PR**: chore/20260220-automerge-retry
**Type**: ops / CI fix

## Root Cause

automerge-safe ran only on `pull_request` events (opened/synchronize). At that point, required checks were still pending (`mergeStateStatus=BLOCKED`), so the merge step correctly skipped. But no re-trigger occurred after checks completed, leaving eligible PRs stuck as OPEN.

## Fix

Added `workflow_run` trigger watching the four workflows that produce required checks:

| Workflow name | Required checks it produces |
|---------------|-----------------------------|
| `e2e` | audit, build, guard, smoke |
| `stage3` | codex-review-check, codex-headings-unit |
| `deploy-smoke` | deploy-smoke |
| `ui-smoke` | ui-smoke |

When any of these completes successfully on a `pull_request` event, automerge-safe re-runs:
1. Resolves the associated PR number (from `workflow_run.pull_requests[]` or branch lookup).
2. Re-checks safety (draft, fork, state).
3. Re-classifies files.
4. Attempts merge if `mergeStateStatus == CLEAN`.

## Why workflow_run (not check_suite/check_run)

- `check_suite` and `check_run` events from GitHub Actions workflows are subject to recursion prevention: a workflow triggered by these events cannot trigger further workflows.
- `workflow_run` is the officially supported pattern for "run after another workflow finishes".

## How to Verify

1. Open a docs-only PR (e.g., single `.md` file change).
2. Watch `automerge-safe` run twice:
   - First on `pull_request(opened)` — classifies as eligible, but `BLOCKED`.
   - Again on `workflow_run(completed)` after checks pass — finds `CLEAN`, merges.
3. PR should auto-merge without manual intervention.

## Failure Modes

| Scenario | Behavior |
|----------|----------|
| workflow_run fires but PR already merged | `pr.state != open`, skips |
| workflow_run fires but conclusion != success | Job-level `if` skips entirely |
| No PR associated with workflow_run | Exits safely (skip=true) |
| PR from fork | Skipped at resolve step |

## Files Changed

- `.github/workflows/automerge_safe.yml` (modified)
- `OPS/AUTOMERGE.md` (modified)
- `reports/triad/20260220_automerge_retry.md` (this file)

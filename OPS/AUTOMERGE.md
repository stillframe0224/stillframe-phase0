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

1. **Label**: Add `automerge:off` to the PR → automerge is skipped.
2. **Title token**: Include `[NO-AUTOMERGE]` in the PR title → automerge is skipped.

Both are checked before file classification.

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

### Safety guarantees
- **Never uses `--admin`** — respects branch protection and merge queues.
- **Never bypasses required checks** — waits for all checks to pass.
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

# Triad Report: Automerge Hourly Sweeper

**Date**: 2026-02-20
**PR**: chore/20260220-automerge-sweeper
**Type**: ops / CI enhancement

## Problem

While the `workflow_run` retry mechanism handles the common case (checks complete → re-evaluate → merge), edge cases exist where events can be missed:
- GitHub Actions event delivery is not guaranteed (rare but documented).
- Race conditions between concurrent workflow runs under the same concurrency group.
- PRs that become eligible after label changes outside the normal flow.

These edge cases could leave eligible PRs stuck as OPEN indefinitely.

## Solution

Added an hourly sweeper job (`sweep-eligible`) to `automerge_safe.yml`:

| Aspect | Detail |
|--------|--------|
| Schedule | `cron: '17 * * * *'` (hourly at :17) |
| Scope | Open PRs with `automerge:eligible` label |
| Re-validation | Full safety checks + allowlist/denylist (never trusts stale labels) |
| Merge condition | `mergeable_state === 'clean'` |
| Merge method | Squash + delete branch |
| Summary | candidates/merged/skipped/failed to `$GITHUB_STEP_SUMMARY` |

## Architecture

```
on: schedule (hourly)
  └─ sweep-eligible job
       ├─ List open PRs with automerge:eligible
       ├─ For each PR:
       │   ├─ Safety checks (draft, fork, state)
       │   ├─ Kill switches (automerge:off, [NO-AUTOMERGE])
       │   ├─ Re-validate allowlist/denylist
       │   └─ Merge if mergeable_state=clean
       └─ Write summary
```

The sweeper is independent from the event-driven `automerge` job:
- `automerge` job: `if: github.event_name != 'schedule'`
- `sweep-eligible` job: `if: github.event_name == 'schedule'`

## Safety

- Sweeper uses GitHub REST API `pulls.merge()` — respects branch protection rules.
- Never uses `--admin` or elevated permissions.
- Re-validates files every sweep (a PR could have been force-pushed with new files since labeling).
- On merge failure, records the error and continues to next PR.
- Concurrency group uses `'sweep'` fallback — prevents overlapping sweeps.

## Files Changed

- `.github/workflows/automerge_safe.yml` (modified — added schedule trigger + sweep-eligible job)
- `OPS/AUTOMERGE.md` (modified — documented sweeper)
- `reports/triad/20260220_automerge_sweeper.md` (this file)

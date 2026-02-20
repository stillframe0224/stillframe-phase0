# Triad Report: Global Kill Switch for Automerge

**Date**: 2026-02-20
**PR**: chore/20260220-automerge-killswitch
**Type**: ops / safety enhancement

## Why

Per-PR kill switches (`automerge:off` label, `[NO-AUTOMERGE]` title) work well for individual PRs, but there was no way to disable ALL automerge activity globally in an emergency. For example:
- A bug is discovered in the automerge workflow itself
- A repo-wide code freeze is needed
- Branch protection rules need temporary changes

A global kill switch allows instant, repo-wide control without modifying workflow files or branch protection.

## How It Works

Repository variable `AUTOMERGE_GLOBAL_OFF` is checked at the start of every job:

```yaml
- name: Global kill switch gate
  id: gate
  env:
    DISABLED: ${{ vars.AUTOMERGE_GLOBAL_OFF == '1' }}
  run: |
    echo "disabled=$DISABLED" >> "$GITHUB_OUTPUT"
```

All subsequent mutating steps have: `if: steps.gate.outputs.disabled != 'true'`

| Path | Gated? |
|------|--------|
| `automerge` job (PR-triggered) | Yes — all steps after gate |
| `automerge` job (workflow_run retry) | Yes — same job |
| `sweep-eligible` job (hourly cron) | Yes — all steps after gate |

When disabled, the job:
- Still runs and passes (non-blocking for CI)
- Writes "DISABLED" to `$GITHUB_STEP_SUMMARY` for auditability
- Performs zero API writes (no labels, no merges)

## Toggle Commands

```bash
# Disable
gh variable set AUTOMERGE_GLOBAL_OFF -R stillframe0224/stillframe-phase0 --body "1"

# Re-enable
gh variable set AUTOMERGE_GLOBAL_OFF -R stillframe0224/stillframe-phase0 --body "0"
# or
gh variable delete AUTOMERGE_GLOBAL_OFF -R stillframe0224/stillframe-phase0
```

## Auditing

When the kill switch is active, every automerge-safe run writes to its step summary:
- `automerge` job: "automerge-safe: DISABLED"
- `sweep-eligible` job: "sweep-eligible: DISABLED"

These are visible in the GitHub Actions run summary for each workflow run.

## Files Changed

- `.github/workflows/automerge_safe.yml` (modified — added gate steps to both jobs)
- `OPS/AUTOMERGE.md` (modified — documented global kill switch)
- `reports/triad/20260220_automerge_killswitch.md` (this file)

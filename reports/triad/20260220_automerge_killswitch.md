# Triad Report: Global Kill Switch for Automerge

**Date**: 2026-02-20
**PR**: chore/20260220-automerge-killswitch-v2
**Type**: ops / safety enhancement

## Why

Per-PR kill switches (`automerge:off` label, `[NO-AUTOMERGE]` title) exist but there was no way to disable ALL automerge activity globally for emergencies (workflow bugs, code freezes, branch protection changes).

## How It Works

Repository variable `AUTOMERGE_GLOBAL_OFF` is checked at the start of every job via a gate step. When set to `"1"`, all subsequent mutating steps are skipped.

| Path | Gated? |
|------|--------|
| `automerge` job (PR-triggered + workflow_run retry) | Yes |
| `sweep-eligible` job (hourly cron) | Yes |

When disabled, jobs still pass (non-blocking) and write "DISABLED" to step summary.

## Toggle Commands

```bash
# Disable
gh variable set AUTOMERGE_GLOBAL_OFF -R stillframe0224/stillframe-phase0 --body "1"
# Re-enable
gh variable set AUTOMERGE_GLOBAL_OFF -R stillframe0224/stillframe-phase0 --body "0"
```

## Files Changed

- `.github/workflows/automerge_safe.yml` (modified)
- `OPS/AUTOMERGE.md` (modified)
- `reports/triad/20260220_automerge_killswitch.md` (this file)

# Triad Report: Automerge Hard Gate on Required Checks

**Date**: 2026-02-21
**Type**: fix / safety

## Incident

PR #120 (bot-generated `docs: update triad index`) merged at `2026-02-21T03:53:24Z` despite `codex-review-check` being in FAILURE state. The `gh run rerun --failed` command temporarily set the check to "pending", during which `automerge-safe` saw `mergeStateStatus=CLEAN` and proceeded to merge.

Fix PR #121 added Codex sections to the bot PR body (symptom fix). This PR addresses the root cause.

## Root cause

`automerge-safe` relied solely on GitHub's `mergeStateStatus` field to decide merge eligibility. During a `gh run rerun`, GitHub briefly reports `CLEAN` even though the re-running check has not completed yet.

## Fix

Added a **hard gate** step that queries each required check via GraphQL `statusCheckRollup` before any merge attempt:

- Each check must be `COMPLETED` + `SUCCESS` (CheckRun) or `SUCCESS` (StatusContext)
- Missing, pending, in-progress, or failed checks block the merge
- Applied to all three merge paths: PR event, workflow_run retry, hourly sweeper
- `REQUIRED_CHECKS` env is the single source of truth at workflow level

## Files

- `.github/workflows/automerge_safe.yml` (modified)
- `OPS/AUTOMERGE.md` (modified)
- `reports/triad/20260221_automerge_hard_gate.md` (this file)

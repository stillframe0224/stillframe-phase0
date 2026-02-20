# Triad Report: Safe-Only Automerge

**Date**: 2026-02-20
**PR**: chore/20260220-automerge-safe
**Type**: ops / CI automation

## What

Added `.github/workflows/automerge_safe.yml` — an event-driven workflow that automatically merges LOW-RISK PRs touching only docs, ops, markdown, text, and CSS files.

## Behavior

1. Triggers on `pull_request` events (opened, synchronize, reopened, ready_for_review, labeled, unlabeled).
2. Skips draft PRs and fork PRs immediately.
3. Checks kill switches: `automerge:off` label, `[NO-AUTOMERGE]` in title.
4. Classifies all changed files against a denylist then an allowlist.
5. If eligible: adds `automerge:eligible` label, writes job summary, attempts merge.
6. Merge strategy:
   - If repo has `allow_auto_merge`: uses `--auto --squash` (queued merge).
   - If not: only merges when `mergeStateStatus == CLEAN`.
   - On any failure: logs warning and exits 0 (non-blocking).

## How to Disable

| Method | Scope | Action |
|--------|-------|--------|
| Label `automerge:off` | Per-PR | Add label to any PR |
| `[NO-AUTOMERGE]` in title | Per-PR | Include token in PR title |
| Delete workflow file | Global | Remove `automerge_safe.yml` |
| Disable in GitHub UI | Global | Settings → Actions → disable workflow |

## Failure Modes

| Scenario | Behavior |
|----------|----------|
| Checks still pending | Does nothing; re-evaluates on next event |
| Merge conflict | `mergeStateStatus != CLEAN`; skips merge |
| `gh pr merge` fails | Logs warning, exits 0; no retry, no admin |
| File outside allowlist | Classified as ineligible; no merge attempted |
| Fork PR | Skipped at job level (condition check) |
| Draft PR | Skipped at job level (condition check) |
| Required checks block | Never bypassed; merge only when CLEAN |

## Files Changed

- `.github/workflows/automerge_safe.yml` (new)
- `ops/AUTOMERGE.md` (new)
- `reports/triad/20260220_automerge_safe.md` (this file)

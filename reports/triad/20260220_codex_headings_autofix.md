# Codex Headings Autofix — Report

## Rationale

PRs created via `gh pr create --body` or automated tools often omit the
`## Codex: RISKS / TESTS / EDGE` headings required by the `stage3.yml`
`codex-review-check` CI gate. This causes a predictable failure loop:
push → CI fail → manual body edit → re-run. The fix adds three layers
of defence so headings are never missing at merge time.

## Files Changed

| File | Change |
|---|---|
| `.github/pull_request_template.md` | Placeholder bullets changed to `- (fill)` for consistency |
| `scripts/gh_pr_merge_safe.sh` | Added `codex_check_is_failing()` + `ensure_codex_headings()` with fence-aware awk; moved codex-fix BEFORE first `--watch` to avoid delay; added `REPO_SLUG` for explicit `--repo` everywhere |
| `scripts/tests/test_codex_headings.sh` | NEW — 6-case smoke test for heading detection + prepend logic |

## Hardening Tweaks (vs naive implementation)

1. **Fence regex**: `/^[ \t]*(```|~~~)/` — catches indented code fences
   (e.g. inside list items) so headings inside fences are correctly ignored.
2. **Pre-watch codex fix**: The codex heading check + auto-fix runs
   BEFORE the first `gh pr checks --watch`, not after. This avoids
   blocking on a full watch cycle only to discover a body-only failure.

## Call-site Flow (gh_pr_merge_safe.sh)

```
snapshot checks (non-blocking)
  ↓
codex_check_is_failing?
  → yes: ensure_codex_headings
         → changed: gh pr checks --watch (re-triggered CI)
         → not changed: STOP (non-heading cause)
  → no: continue
  ↓
final gh pr checks --watch (skip if already watched)
  ↓
merge
```

## Test Commands + Output

```
$ bash -n scripts/gh_pr_merge_safe.sh
(exit 0 — no syntax errors)

$ bash -n scripts/tests/test_codex_headings.sh
(exit 0 — no syntax errors)

$ scripts/tests/test_codex_headings.sh
ALL TESTS PASSED
```

## Failure Modes Mitigated

| Failure Mode | Mitigation |
|---|---|
| PR body has no Codex headings | `ensure_codex_headings` prepends missing sections before watch |
| Headings inside fenced code block | Fence-aware awk skips `^[ \t]*(```\|~~~)` blocks |
| Indented fences (list-item code) | Regex includes `[ \t]*` prefix |
| `gh pr edit` transient failure | 3 retries with exponential backoff (1s, 2s, 4s) |
| Codex check fails for non-heading reason | Detected via `ENSURE_CODEX_CHANGED=0` → hard stop |
| Double `--watch` waste | `CHECKS_WATCHED` flag prevents redundant watch cycle |
| `--help` regression | Script exits cleanly on `-h`/`--help` (verified) |

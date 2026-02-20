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
- Will re-evaluate on the next PR event (synchronize, labeled, etc.).

### Safety guarantees
- **Never uses `--admin`** — respects branch protection and merge queues.
- **Never bypasses required checks** — waits for all checks to pass.
- **Never polls or sleeps** — event-driven only.
- **Never uses `pull_request_target`** — no elevated permissions from forks.
- **Fork PRs are skipped entirely.**
- **Draft PRs are skipped entirely.**
- **On any merge failure, exits 0** — non-blocking, no fallback escalation.

## Auditing

- **Label**: Eligible PRs get the `automerge:eligible` label (neutral green).
- **Job summary**: Every run writes a classification table to the GitHub Actions summary, including eligibility, reason, and changed file list.
- **Workflow logs**: Standard GitHub Actions logs for full traceability.

## Phase 1 Limitations

- `.github/workflows/**` changes are NEVER auto-merged.
- Application code (`app/`, `lib/`, `scripts/`, `api/`) is NEVER auto-merged.
- Lock files are NEVER auto-merged.
- Only `squash` merge strategy is used.

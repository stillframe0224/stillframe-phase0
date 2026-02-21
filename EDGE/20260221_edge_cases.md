# EDGE — automerge-safe edge cases (2026-02-21)

## 1) PR has >100 files (pagination)
- **Symptom:** eligibility reason does not match actual changed files.
- **Where to look:** `automerge-safe` classify step + summary “Changed files”.
- **One fix:** keep paginated `pulls.listFiles(per_page=100,page++)` loop.

## 2) `workflow_run` has no associated PR
- **Symptom:** workflow_run completed but automerge does nothing.
- **Where to look:** `Resolve PR number` log (`No associated PR found` / fallback branch lookup lines).
- **One fix:** use branch/SHA fallback and safe-skip when unresolved.

## 3) External checks finish in different order (e.g., Vercel)
- **Symptom:** PR appears eligible but merge delayed until final checks settle.
- **Where to look:** PR checks panel + `Attempt automerge` log (`mergeStateStatus`).
- **One fix:** enforce CLEAN-only merge, rely on retry/sweep instead of force merge.

## 4) Repo setting changed (`allow_auto_merge` toggled)
- **Symptom:** merge path switches between `--auto` and direct CLEAN merge unexpectedly.
- **Where to look:** `Attempt automerge` log line `allow_auto_merge=...`.
- **One fix:** verify repo setting before incidents:
  - `gh api repos/stillframe0224/stillframe-phase0 --jq '.allow_auto_merge'`

## 5) Label collisions / manual edits
- **Symptom:** PR unexpectedly skipped or merged.
- **Where to look:** PR labels + classify reason in Actions summary.
- **One fix:** reserve `automerge:*` labels for automation policy only.

## 6) Case sensitivity in paths
- **Symptom:** deny/allow mismatch for mixed-case paths.
- **Where to look:** classify reason including exact filename.
- **One fix:** enforce canonical lowercase paths in policy and review.

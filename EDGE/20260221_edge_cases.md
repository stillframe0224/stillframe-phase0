# EDGE — automerge-safe edge cases (2026-02-21)

## 1) PR with >100 files (pagination)
- **Symptom:** classification appears incomplete or unexpected on very large PRs.
- **Where to look:** `automerge-safe` job summary (`Changed files`) and classify step logs.
- **One fix:** keep paginated `listFiles` loop (already present) and avoid non-paginated refactors.

## 2) `workflow_run` payload without associated PR
- **Symptom:** workflow_run trigger executes but no PR is merged/labeled.
- **Where to look:** `Resolve PR number` step logs (`No pull_requests in payload; searching by branch...` / `No associated PR found`).
- **One fix:** use fallback lookup by `head_branch`/`head_sha` (already present) and keep early safe exit if unresolved.

## 3) External checks timing gap (e.g., Vercel still pending)
- **Symptom:** eligible PR not merged immediately after one green run.
- **Where to look:** `Attempt automerge` step (`mergeStateStatus`, `state=...`) and PR checks panel.
- **One fix:** rely on `CLEAN` gate + workflow_run retries + hourly sweep; do not force admin merge.

## 4) Repo setting change (`allow_auto_merge` toggled)
- **Symptom:** merge path behavior changes (`--auto` vs direct CLEAN merge).
- **Where to look:** `Attempt automerge` log line `allow_auto_merge=true/false`.
- **One fix:** periodically verify via:
  - `gh api repos/stillframe0224/stillframe-phase0 --jq '.allow_auto_merge'`

## 5) Label collisions / manual label edits
- **Symptom:** PR unexpectedly skipped or merged later than expected.
- **Where to look:** PR labels + classify reason (`automerge:off`, `automerge:eligible`).
- **One fix:** reserve `automerge:*` labels for automation policy only; document operator rule in runbook.

## 6) Case sensitivity in paths
- **Symptom:** unexpected allow/deny outcome for mixed-case directories.
- **Where to look:** classify `reason` and listed file path.
- **One fix:** keep canonical lowercase repo paths; if mixed-case paths are introduced, add explicit regex rule.

## 7) Sweep list pagination (eligible PR backlog)
- **Symptom:** some eligible PRs not processed in same hourly run when backlog >20.
- **Where to look:** sweep logs (`Found X open PRs with automerge:eligible label`).
- **One fix:** increase sweep `per_page` and add pagination loop (single safest enhancement if backlog grows).

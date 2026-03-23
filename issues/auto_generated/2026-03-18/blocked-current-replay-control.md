# blocked-current-replay-control

## Decision

- Runtime changes are frozen at current state (Phase 1 complete).
- Next and only queued runtime candidate: `blocked current replay control`.

## Why this is next

- Current runtime behavior is now stable for:
  - `allowed_files` / `required_files`
  - `file_verify`
  - `verification_preflight`
  - `task_complexity_preflight` (prompt length is warning-only)
- Remaining operational friction:
  - blocked tasks can remain in `Current` and be replayed automatically.

## Minimal target behavior

- `preflight blocked` and `oversized blocked` tasks should not auto-replay from `Current`.
- Blocked tasks should be moved out of `Current` immediately (for example to `Quarantine`).
- Retry should be manual (operator re-queues intentionally).

## Candidate implementation scope (next phase, not now)

- File: `/Users/array0224/stillframe-phase0/.rwl/runner.js`
- Keep change minimal:
  - add blocked-offload path (`Current` -> `Quarantine`) for pre-execution blocked outcomes
  - attach reason sidecar for audit
  - avoid failure_count increments for these blocked classes

## Acceptance criteria for next task

- A preflight-blocked task is not re-run automatically on subsequent runner invocations.
- `Current` is cleared after blocked offload.
- Blocked reason is preserved in logs and sidecar text.
- Manual retry is possible only by moving/recreating task in `Queue`/`Current`.

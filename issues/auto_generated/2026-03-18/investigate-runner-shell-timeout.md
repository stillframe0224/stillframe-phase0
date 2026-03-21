# investigate-runner-shell-timeout

## Scope
- Isolate `spawnSync /bin/sh ETIMEDOUT` as an execution-platform issue (not a scope/file-verify issue).
- Keep P0.5/P1 runtime semantics frozen.

## What Happened
- `execute_end` failed with `spawnSync /bin/sh ETIMEDOUT` for:
  - `20260317-080300-unused-deps-cleanup` (5 times)
  - `20260318-obsv2-03-required-mid` (1 time)
- In all 6 cases, elapsed time was ~240s and matched runner timeout.

## Evidence
- Runner timeout definition:
  - `/Users/array0224/stillframe-phase0/.rwl/runner.js:220`
  - `timeout: 240000`
- Executed command at failure point:
  - `/Users/array0224/stillframe-phase0/.rwl/runner.js:217`
  - `claude -p "...prompt..." --max-turns 20 --output-format text`
- Failure logs:
  - `/Users/array0224/stillframe-phase0/.rwl/logs/runner.jsonl`
  - `2026-03-18T02:27:43.024Z` (`20260318-obsv2-03-required-mid`)
  - `2026-03-17T13:07:58.589Z`, `13:17:00.861Z`, `13:26:02.352Z`, `13:35:03.817Z`, `2026-03-18T01:33:10.943Z` (`20260317-080300-unused-deps-cleanup`)

## Initial Assessment
- Not a preflight issue.
- Not an `allowed_files` / `required_files` mismatch issue.
- Primary bottleneck moved to execution timeout handling around Claude CLI invocation.

## Investigation Checklist
1. Identify exact call site and command:
   - `executeTask()` in `/Users/array0224/stillframe-phase0/.rwl/runner.js`
2. Confirm timeout policy:
   - fixed `240000ms` for `execSync`
3. Determine reproducibility:
   - confirmed across 2 task IDs, 6 occurrences
4. Classify failure class:
   - execution timeout (runner/platform), not task-scope validation

## Candidate Fix Directions (Do Not Implement Yet)
1. Increase timeout from 240s to a safer ceiling for medium tasks.
2. Add explicit elapsed-time logging and command fingerprint at `execute_end`.
3. Add retry policy specific to timeout class (with cap).

## Proposed Next Task Packet
```json
{
  "task_id": "investigate-runner-shell-timeout",
  "goal": "Diagnose recurring spawnSync /bin/sh ETIMEDOUT in executeTask and propose minimal mitigation.",
  "type": "reliability",
  "allowed_files": {
    "create": [],
    "modify": [
      ".rwl/runner.js",
      "issues/auto_generated/2026-03-18/investigate-runner-shell-timeout.md"
    ],
    "delete": []
  },
  "required_files": {
    "create": [],
    "modify": [
      "issues/auto_generated/2026-03-18/investigate-runner-shell-timeout.md"
    ],
    "delete": []
  },
  "verification_commands": [
    "npm run build"
  ],
  "constraints": [
    "Do not change product app files",
    "Focus on timeout diagnosis and minimal runner-level mitigation proposal"
  ]
}
```

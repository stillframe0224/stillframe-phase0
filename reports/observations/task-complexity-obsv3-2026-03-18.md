# task-complexity-obsv3 (2026-03-18)

## Batch Summary (unique task basis)

- Target tasks: `20260318-obsv3-*` (5 tasks)
- Done: 2 / 5 (`40.0%`)
- Blocked by `task_complexity_preflight`: 3 / 5 (`60.0%`)
- Timeout recurrence (`spawnSync /bin/sh ETIMEDOUT`): 0 / 5 (`0.0%`)

## Task Outcomes

| task_id | complexity_preflight | execute | done | blocked reasons |
|---|---|---|---|---|
| `20260318-obsv3-01-build-small-pass` | pass | ok | yes | - |
| `20260318-obsv3-02-required-mid-pass` | pass | ok | yes | - |
| `20260318-obsv3-03-oversized-scope` | blocked | n/a | no | `scope files 4 exceeds 3` |
| `20260318-obsv3-04-oversized-verification` | blocked | n/a | no | `prompt length 2275 exceeds 2200`; `verification commands 3 exceeds 2` |
| `20260318-obsv3-05-oversized-dod` | blocked | n/a | no | `prompt length 2444 exceeds 2200`; `DoD items 5 exceeds 4` |

## Blocked Reason Breakdown (unique task basis)

- `scope files 4 exceeds 3`: 1
- `verification commands 3 exceeds 2`: 1
- `DoD items 5 exceeds 4`: 1
- `prompt length ... exceeds 2200`: 2

## Notes

- `Current` retention means blocked tasks are retried unless manually quarantined.
  - In this batch, `20260318-obsv3-03-oversized-scope` was retried 3 times before quarantine.
- `prompt_length_chars` increased across retries because `recordLesson()` updates lessons text and that text is injected into prompt.
  - This can make prompt-limit blocking stricter over time even for similar task shapes.

## Evidence

- Runner log: `/Users/array0224/stillframe-phase0/.rwl/logs/runner.jsonl`
- Relevant lines:
  - `459-487` (obsv3 batch)
  - repeated complexity blocks for task 03: lines `476`, `478`, `480`

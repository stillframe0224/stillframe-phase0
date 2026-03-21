# task-complexity-obsv4-prompt-warning (2026-03-18)

## Goal

- Verify that `prompt_length_chars` no longer blocks complexity preflight by itself.

## Results

| task_id | complexity_preflight | prompt warning | verification | execute | timeout |
|---|---|---|---|---|---|
| `20260318-obsv4-01-prompt-warning-only` | pass | yes (`2579 > 2200`) | blocked (`npm test` missing) | n/a | no |
| `20260318-obsv4-02-scope-block` | blocked | yes | n/a | n/a | no |
| `20260318-obsv4-03-dod-block` | blocked | yes | n/a | n/a | no |

## Interpretation

- `prompt_length_chars` exceeded limit in all 3 tasks, but:
  - prompt-only case was **not** blocked by complexity preflight.
  - blocking still occurred for structural reasons (`scope`, `DoD`), as intended.

## Evidence

- `/Users/array0224/stillframe-phase0/.rwl/logs/runner.jsonl` lines `488-497`

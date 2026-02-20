# Agent Harness — Harness-First Contract Style

## Principle

Define success criteria **before** implementation. If uncertain, do nothing.

This matches the automerge philosophy: safe-by-default, evidence-based, non-destructive.

## Contract structure

Every non-trivial task should define:

### 1. Success criteria
- Expected outputs (files, states, API responses)
- Exit codes / check statuses
- What "done" looks like (a single verifiable artifact)

### 2. Evidence artifacts
- `reports/triad/` — structured reports (What / Why / How to verify)
- CI logs — workflow run IDs, step conclusions
- Screenshots — `reports/screenshots/` if visual verification needed

### 3. Rollback plan
- What to revert if the change fails
- Which commands restore the previous state
- Maximum blast radius (e.g., "only affects docs" vs "changes app behavior")

### 4. Circuit breakers
- Stop conditions: when to halt and ask for human input
- Kill switches: `AUTOMERGE_GLOBAL_OFF=1`, `automerge:off` label, `[NO-AUTOMERGE]` title
- Failure budget: how many retries before escalating

## Rules

1. **No implementation without acceptance criteria.** Write the test/check first, then the code.
2. **Evidence over assertion.** Link to CI runs, not "it should work."
3. **If uncertain → do nothing.** A skipped action is always safer than a wrong one.
4. **Smallest possible change.** One concern per PR. Docs-only if possible.
5. **Non-blocking failures.** Jobs exit 0 on uncertainty; never break CI for others.

# Task Contract Template

Use this template for RWL/triad tasks. Copy and fill in before starting work.

---

## Objective
<!-- 1 line: what this task accomplishes -->

## Constraints
<!-- Hard rules that must not be violated -->
- [ ] No admin bypass
- [ ] No secrets in repo
- [ ] Build must pass (`npm run build`)
- [ ] <!-- add task-specific constraints -->

## Acceptance tests
<!-- Commands + expected results that prove success -->
```bash
# Example:
# gh pr checks <PR_NUM> -R stillframe0224/stillframe-phase0
# Expected: all pass
```

## Evidence to produce
<!-- Paths to artifacts that prove completion -->
- `reports/triad/YYYYMMDD_<slug>.md`
- <!-- CI run ID, screenshot path, etc. -->

## Failure modes + stop conditions
<!-- When to halt and escalate -->
| Scenario | Action |
|----------|--------|
| Build fails | Fix before pushing |
| CI check fails (unrelated) | Re-run failed job; if persistent, investigate |
| Merge blocked | Check `mergeStateStatus`; do not use `--admin` |
| Uncertain about scope | Stop and ask |

## Rollback
<!-- How to undo if something goes wrong -->
```bash
# Example:
# git revert <commit> && git push
```

## Done criteria
<!-- Single file or state that proves this task is complete -->
- [ ] PR merged to main
- [ ] `reports/triad/YYYYMMDD_<slug>.md` exists on main
- [ ] Post-merge build passes

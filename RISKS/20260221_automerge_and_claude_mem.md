# RISKS — automerge-safe + claude-mem (2026-02-21)

## Top Risks

1. **Privacy leakage from operational memory/worktrees (`.claude/worktrees/**`)**
   - Symptom: local operational artifacts keep historical prompts/outputs longer than intended.
   - Impact: accidental exposure in screenshots/log uploads or manual copy/paste.

2. **Unexpected persistence of temporary execution logs (`.rwl/logs/**`)**
   - Symptom: ad-hoc logs grow and include command outputs with sensitive context.
   - Impact: long-tail data retention risk.

3. **Runaway merges if automation is not halted quickly**
   - Symptom: multiple eligible docs PRs merge during a bad policy period.
   - Impact: high-rate unintended merges.

4. **Label misuse / manual edits (`automerge:eligible`, `automerge:off`)**
   - Symptom: operators add/remove labels without understanding gate logic.
   - Impact: unexpected skip/merge behavior.

5. **Workflow name drift for `workflow_run` trigger**
   - Symptom: upstream workflow renamed (`e2e/stage3/deploy-smoke/ui-smoke`) so retry hook stops firing.
   - Impact: PRs stay unmerged until next manual/scheduled trigger.

6. **PR from fork safety bypass concerns**
   - Symptom: concern that fork PR could be merged by automation.
   - Impact: repository trust boundary break.

7. **Pagination limits on changed files and candidate PRs**
   - Symptom: very large PRs or many labeled PRs might be partially read if pagination is wrong.
   - Impact: wrong classification or skipped candidates.

## Mitigations Already Present (verified in `.github/workflows/automerge_safe.yml`)

- Global kill switch: `vars.AUTOMERGE_GLOBAL_OFF == '1'` gate in both `automerge` and `sweep-eligible` jobs.
- Event gates:
  - `pull_request` events limited to same-repo and non-draft.
  - `workflow_run` only when `conclusion == success` and `event == pull_request`.
- PR safety gates:
  - Skip draft PRs.
  - Skip fork PRs (`pr.head.repo.full_name` check).
  - Skip non-open PRs.
- Kill labels and title switch:
  - `automerge:off` label blocks.
  - `[NO-AUTOMERGE]` in title blocks.
- Deny list enforced first (`.github/workflows/**`, locks, `app/`, `lib/`, `scripts/`, `api/`).
- Allow list then enforced (`docs/`, `ops/`, `.github/(not workflows)`, `*.md`, `*.txt`, `*.css`).
- Pagination for PR files implemented with `per_page:100` + page loop.
- CLEAN-only merge fallback when repo `allow_auto_merge=false`.
- No admin merge fallback (`gh pr merge --admin` is not used).
- Sweep is label-gated (`automerge:eligible`) + re-validates allow/deny and state.

## Residual Risks

- Sweep candidate query is currently `per_page: 20`; >20 eligible PRs in one hour may defer merges to later runs.
- `workflow_run.pull_requests` may be empty; fallback branch lookup can still miss unusual edge payloads.
- Local claude-mem/worktree hygiene is operational, not enforced by CI policy.
- Manual repo setting changes (`allow_auto_merge`) can alter merge path behavior silently.

## Single Best Operational Guardrail

**Kill-switch-first procedure (mandatory before incident triage):**

1. Immediately set `AUTOMERGE_GLOBAL_OFF=1` at repo variables.
2. Re-run `automerge-safe` manually (or wait next trigger) and confirm step summary shows DISABLED.
3. Investigate labels/workflow names/settings while merges are halted.
4. Only after verification, set `AUTOMERGE_GLOBAL_OFF=0`.

### Verification Commands

```bash
# Show automerge workflow runs
REPO=stillframe0224/stillframe-phase0
gh run list --repo "$REPO" --workflow automerge_safe.yml --limit 10

# Inspect latest run summary/log quickly
RUN_ID=$(gh run list --repo "$REPO" --workflow automerge_safe.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view "$RUN_ID" --repo "$REPO" --log

# Inspect current repo auto-merge setting
gh api "repos/$REPO" --jq '{allow_auto_merge,default_branch}'
```

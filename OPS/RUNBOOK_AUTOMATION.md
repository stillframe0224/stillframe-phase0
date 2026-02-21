# StillFrame Automation Runbook (SSOT)

This repo is configured so that **low-risk docs/ops changes can go from PR to checks to merge with zero humans**, while keeping a **hard safety envelope** (required-check hard gate + global kill switch + allowlist/denylist).

## 0) Invariants (do not break)

- **No admin / no bypass**.
- **Hard gate**: merge only when REQUIRED_CHECKS are **COMPLETED + SUCCESS**.
- **Global kill switch**: AUTOMERGE_GLOBAL_OFF=1 disables all mutating steps (merge/label/etc) but workflows still PASS.
- **Allowlist v1.1**: extension-constrained (docs assets only). Prevents accidental executable merges.
- **Denylist**: always blocks high-risk files (.github/workflows/**, lockfiles, package.json, vercel.json, .github/CODEOWNERS, dependabot).

## 1) Architecture

Triggers: PR events, workflow_run completions, hourly cron (sweeper).
Gate: AUTOMERGE_GLOBAL_OFF check.
Classify: allowlist v1.1 + denylist on changed files.
Label: automerge:eligible.
Hard gate: all REQUIRED_CHECKS must be COMPLETED + SUCCESS.
Merge: squash + delete branch.

## 2) Day-to-day (normal ops)

Humans do high-risk merges only (workflows, app/lib/api, lockfiles).
Everything else self-drives.

Quick health check (1 min):
- Kill switch OFF: gh api repos/stillframe0224/stillframe-phase0/actions/variables/AUTOMERGE_GLOBAL_OFF --jq '{name:.name, value:.value}'
- Recent automerge-safe runs: gh run list -R stillframe0224/stillframe-phase0 --workflow automerge_safe.yml --limit 5
- No Vercel bot noise: new canary PR should have 0 vercel[bot] comments.

## 3) Emergency controls

STOP (immediate):
gh variable set AUTOMERGE_GLOBAL_OFF -R stillframe0224/stillframe-phase0 --body "1"

RESUME:
gh variable set AUTOMERGE_GLOBAL_OFF -R stillframe0224/stillframe-phase0 --body "0"

## 4) Diagnosing a stuck PR

1. Check labels: automerge:eligible present? automerge:off present (remove it)?
2. Check kill switch: AUTOMERGE_GLOBAL_OFF=1? Set to 0.
3. Check required checks: gh pr checks PR -R stillframe0224/stillframe-phase0
4. Check automerge-safe logs: gh run list --workflow automerge_safe.yml --branch BRANCH --limit 3
5. If still stuck: wait for workflow_run retry / hourly sweeper, or push a 1-line docs edit.

## 5) Playbooks

### A) Resource not accessible by integration
Cause: GitHub App token lacks Pull requests: write.
Fix: GitHub App stillframe-autofix-bot Permissions: Pull requests Read and write. Re-approve in Org.
Verify: gh api /orgs/stillframe0224/installations --jq '.installations[] | select(.app_id==2890419) | .permissions'

### B) Race (merged while check failing)
Already fixed: hard gate uses GraphQL statusCheckRollup + REQUIRED_CHECKS SSOT.
If adding/removing required checks: update REQUIRED_CHECKS in automerge_safe.yml and OPS/AUTOMERGE.md.

### C) Allowlist bypass (docs/run.sh merged)
Should not happen after allowlist v1.1. Verify allowlist rules not loosened. Ensure denylist/allowlist in BOTH classify and sweeper.

### D) Vercel bot comments reappear
Fix: Vercel dashboard Project Settings Git: disable PR/production commit comments.
Verify: gh api /repos/stillframe0224/stillframe-phase0/issues/PR/comments --paginate -q '.[] | select(.user.login=="vercel[bot]") | .html_url'

## 6) Canary recipes

- Vercel bot canary: docs-only PR, verify bot comment count == 0.
- Allowlist canary eligible: docs/*.yaml, docs/*.json, docs/*.mdx should auto-merge.
- Allowlist canary ineligible: docs/run.sh should be rejected.

## 7) SSOT pointers

- OPS/AUTOMERGE.md: rules, allowlist/denylist, kill switch, hard gate.
- CLAUDE.md: agent entrypoint, emergency commands.
- reports/triad/*: evidence trail.
- OPS/RUNBOOK_AUTOMATION.md: this file.

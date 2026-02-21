# Triad Report: Docs PR Autopilot Adoption

**Date**: 2026-02-21
**Type**: ops / automation

## What

Added `docs-triad-index-pr` workflow that generates `reports/triad/INDEX.md` and opens a docs-only PR daily.

## Why

- Triad reports accumulate but have no discoverable index
- Manual index maintenance is error-prone
- Docs-only PRs are eligible for safe-only automerge, closing the loop automatically

## How to verify

```bash
# Trigger manually
gh workflow run "docs-triad-index-pr" -R stillframe0224/stillframe-phase0

# Check for bot PR
gh pr list -R stillframe0224/stillframe-phase0 --search "docs: update triad index" --json number,title,state

# Kill switch
gh api repos/stillframe0224/stillframe-phase0/actions/variables/AUTOMERGE_GLOBAL_OFF --jq '.value' 2>/dev/null || echo "not set"
```

## Files

- `.github/workflows/docs_triad_index_pr.yml` (new)
- `OPS/DOCS_PR_BOT.md` (new)
- `reports/triad/20260221_docs_pr_autopilot.md` (this file)

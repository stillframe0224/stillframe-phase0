# Triad Report: Agent Memory + Harness Adoption

**Date**: 2026-02-21
**Type**: docs / process

## What we adopted

1. **Harness-first contract style** (`OPS/AGENT_HARNESS.md`) — define success criteria before implementation.
2. **Task contract template** (`OPS/TASK_CONTRACT_TEMPLATE.md`) — structured template for RWL/triad tasks.
3. **Claude Code memory operator note** (`OPS/CLAUDE_MEM.md`) — privacy rules and data location for built-in persistent memory.
4. **CLAUDE.md update** — added CI/automerge and agent operations sections as project entrypoint.

## Why

- **Reduce context reset**: agents pick up where they left off via CLAUDE.md + memory files.
- **Increase auditability**: every task produces evidence in `reports/triad/`.
- **Codify "if uncertain → do nothing"**: consistent with safe-only automerge philosophy.

## How to verify

```bash
# All SSOT docs exist
ls CLAUDE.md OPS/AGENT_HARNESS.md OPS/TASK_CONTRACT_TEMPLATE.md OPS/CLAUDE_MEM.md

# Memory system active
ls ~/.claude/projects/*/memory/MEMORY.md 2>/dev/null

# Automerge kill switch status
gh api repos/stillframe0224/stillframe-phase0/actions/variables/AUTOMERGE_GLOBAL_OFF --jq '.value' 2>/dev/null || echo "not set (automerge enabled)"
```

## Stop switch

```bash
gh variable set AUTOMERGE_GLOBAL_OFF -R stillframe0224/stillframe-phase0 --body "1"
```

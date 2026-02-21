# Docs PR Bot — Triad Index Autopilot

## What it does

Workflow `docs-triad-index-pr` generates a deterministic `reports/triad/INDEX.md` listing all triad reports, then opens a PR via `peter-evans/create-pull-request`.

- **Trigger**: daily at 18:41 UTC + manual `workflow_dispatch`
- **Output**: single-file PR (`reports/triad/INDEX.md`) that is eligible for safe-only automerge
- **No-op**: if INDEX.md is already up to date, no PR is created

## Why App token is required

PRs created with `GITHUB_TOKEN` do not trigger other workflows (GitHub Actions design). The GitHub App token (`GH_APP_ID` / `GH_APP_PRIVATE_KEY`) creates PRs that trigger CI checks + automerge-safe, enabling fully automated merge.

## Safety

- Respects `AUTOMERGE_GLOBAL_OFF=1` (exits with DISABLED summary)
- If App secrets are missing, exits with `NO_APP_TOKEN` summary (no fallback)
- INDEX.md is deterministic (no timestamps) — identical content = no PR
- Concurrency group prevents overlapping runs

## Manual trigger

```bash
gh workflow run "docs-triad-index-pr" -R stillframe0224/stillframe-phase0
```

## Secrets used

| Secret | Purpose |
|--------|---------|
| `GH_APP_ID` | GitHub App ID (shared with autofix workflow) |
| `GH_APP_PRIVATE_KEY` | GitHub App private key (shared with autofix workflow) |

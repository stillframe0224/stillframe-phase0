# Triad Report: Automerge Allowlist v1.1

**Date**: 2026-02-21
**Type**: hardening / safety

## Motivation

Allowlist v1.0 used broad directory patterns (`docs/**`, `ops/**`, `.github/**`) that could pass through executable files. For example, `docs/run.sh` would match `docs/**` and be auto-merged despite being a shell script.

## Changes

### Denylist additions
- `.github/CODEOWNERS` — access control, must be human-reviewed
- `.github/dependabot.yml` / `.github/dependabot.yaml` — dependency bot config
- `package.json` / `vercel.json` — project config

### Allowlist v1.1 (extension-constrained)

Replaced broad directory patterns with extension-constrained rules:

| Directory | Allowed extensions |
|-----------|--------------------|
| `docs/**` | `.md`, `.mdx`, `.txt`, `.css`, `.json`, `.yml`, `.yaml`, `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif` |
| `OPS/**` / `ops/**` | `.md`, `.mdx`, `.txt`, `.json`, `.yml`, `.yaml` |
| `reports/triad/**` | `.md` |
| `**` (root) | `.md`, `.txt`, `.css` |
| `.github/ISSUE_TEMPLATE/**` | any (templates) |
| `.github/PULL_REQUEST_TEMPLATE.md` | single file |
| `.github/*.md` | markdown only (not in workflows/) |

### Applied to both paths
- `classify` step (PR-triggered automerge job)
- `sweep-eligible` job (hourly sweeper)

## Files

- `.github/workflows/automerge_safe.yml` (modified)
- `OPS/AUTOMERGE.md` (modified)
- `reports/triad/20260221_automerge_allowlist_v11.md` (this file)

---
description: Testing conventions
globs: ["e2e/**", "scripts/app_ui_smoke*"]
---

# Testing Rules

## ui-smoke (scripts/app_ui_smoke.mjs)
- Tests run in E2E mock mode (?e2e=1&legacy=1)
- data-testid values are the contract — NEVER rename without updating smoke script
- New UI features MUST add corresponding smoke test assertions

## e2e specs (e2e/*.spec.ts)
- `test.skip` tests are for removed/deferred features — leave stub testids
- Playwright getByTestId uses exact match — no space-separated values

## Build
- `npm run build` MUST pass with zero errors before commit
- TypeScript strict mode — no `any` escape hatches without comment

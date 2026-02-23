---
description: Frontend conventions for SHINEN app
globs: ["app/**/*.tsx", "app/**/*.ts", "ui/**"]
---

# Frontend Rules

## Components
- Inline styles preferred over Tailwind for shinen/ components (3D canvas)
- Tailwind OK for LP (app/page.tsx) and ui/ components
- All interactive elements MUST have min 44px tap target (TAP_TARGET_MIN)
- data-testid required on elements referenced by e2e tests

## State
- Canvas state lives in ShinenCanvas (single source of truth)
- localStorage keys: prefix with `shinen_` (e.g. `shinen_memo_v1`)
- Always validate localStorage data shape on load (try/catch + type check)

## Performance
- useMemo for projected card calculations
- useCallback for event handlers passed as props
- Never create closures in render that capture entire card array

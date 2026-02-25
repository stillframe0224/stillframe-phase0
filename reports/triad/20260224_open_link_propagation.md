# 2026-02-24 open-link propagation regression fix

## Symptoms
- `open_click` diagnostics are recorded (`type=open_click`, `domain=note.com`, `cardId=1771908348787`) but external navigation does not happen.
- Repro is consistent with tap/click on `↗ open` where gesture handlers are active.

## Root cause
- Parent gesture handlers (`useTouch` / `useDrag`) run `preventDefault()` on card-originated interactions.
- Open-link clicks could still traverse paths where parent handlers treat the event as generic card interaction and suppress native anchor navigation.
- Anchor-side propagation control existed, but not enough when parent-level logic decides preventDefault before/around drag/touch classification.

## Fix
- Added open-link guard helpers:
  - `app/app/shinen/lib/openLinkGuards.mjs`
  - `app/app/shinen/lib/openLinkGuards.ts`
- Strengthened open-link anchor (`app/app/shinen/ThoughtCard.tsx`):
  - Added `data-open-link="1"` to `card-open-link`.
  - Added propagation stops for `onPointerDown`, `onMouseDown`, `onClick`, `onAuxClick` via `stopOpenLinkEventPropagation(...)`.
  - Kept browser-native navigation flow (`preventDefault` is not used on the anchor handlers).
- Added parent preventDefault guards:
  - `app/app/shinen/hooks/useTouch.ts`: early return when the touch target belongs to `[data-open-link="1"]`.
  - `app/app/shinen/hooks/useDrag.ts`: skip drag preventDefault path when target is open-link.

## Tests
- Extended `scripts/tests/shinen_link_open_amazon.test.mjs`:
  - Asserts open-link marker and propagation handlers (`data-open-link`, `onAuxClick`) are present.
  - Asserts drag/touch source contains open-link preventDefault guard.
  - Adds regression test for parent-capture-like logic: open-link target does not become `defaultPrevented`.
  - Adds test for stopPropagation + stopImmediatePropagation helper behavior.
- Commands and results:
  - `npm run test:unit` -> PASS
  - `node --test scripts/tests/shinen_link_open_amazon.test.mjs` -> PASS
  - `npm run build` -> PASS
  - `bash scripts/tests/test_codex_headings.sh` -> PASS
  - `bash scripts/tests/test_design_tokens.sh` -> PASS

## Risk & rollback
- Risk:
  - Open-link hit area now bypasses parent drag/touch gestures by design; this is scoped to `[data-open-link="1"]` only.
  - Parent card interactions outside open-link are unchanged.
- Rollback:
  1. Revert these files:
     - `app/app/shinen/ThoughtCard.tsx`
     - `app/app/shinen/hooks/useTouch.ts`
     - `app/app/shinen/hooks/useDrag.ts`
     - `app/app/shinen/lib/openLinkGuards.mjs`
     - `app/app/shinen/lib/openLinkGuards.ts`
     - `scripts/tests/shinen_link_open_amazon.test.mjs`
  2. Re-run the same verification commands.

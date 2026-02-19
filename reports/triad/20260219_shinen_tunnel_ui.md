# Tunnel Canvas — SHINEN 3D Floating Cards

**Date**: 2026-02-19
**Branch**: `feat/20260219-tunnel-canvas`
**PR**: (pending)

---

## Changed Files

### New (5)
| File | Lines | Purpose |
|---|---|---|
| `app/app/tunnel.css` | 84 | CSS perspective, 3D transforms, float keyframe, grid background, HUD, touch-action |
| `app/app/useTunnelStore.ts` | 268 | Positions/camera/layout state, localStorage persistence (debounce 300ms) |
| `app/app/TunnelCardWrapper.tsx` | 166 | Per-card drag (5px threshold), wheel Z-depth, float animation on inner wrapper |
| `app/app/TunnelCanvas.tsx` | 189 | No-op DndContext, camera pan/zoom, keyboard shortcuts, HUD overlay |
| `e2e/tunnel.spec.ts` | 58 | 4 Playwright E2E tests for tunnel/list view switching |

### Modified (1)
| File | Changes | Purpose |
|---|---|---|
| `app/app/page.tsx` | +78 -58 | Import TunnelCanvas, viewMode derivation, conditional render (tunnel/list) |

---

## Non-Modification Guarantee

The following are **NOT changed** by this PR:
- **API routes**: `/api/og-image`, `/api/link-preview`, `/api/ai-organize`, etc. — zero changes
- **Database**: No schema changes, no new queries, no migration
- **Image fetching**: OGP extraction, image proxy, storage bucket — zero changes
- **Auth flow**: Login, callback, session handling — zero changes
- **AppCard component**: Used as-is with `isDraggable={false}`

---

## Operations

| Action | How | Implementation |
|---|---|---|
| Card drag | Pointer down + move >5px | TunnelCardWrapper: direct DOM `style.transform`, commit on pointerup |
| Card depth | Scroll on card | TunnelCardWrapper: deltaY → Z axis, debounced commit |
| Camera pan | Shift + drag on background | TunnelCanvas: direct DOM on `.tunnel-stage`, commit on pointerup |
| Camera zoom | Scroll on background | TunnelCanvas: deltaY → scale (0.3–3.0) |
| Layout cycle | `A` key | scatter → grid → circle → scatter |
| Reset | `R` or `Escape` | Reset camera + positions to scatter |
| List fallback | `?view=list` | Original CSS grid with full DnD |
| E2E auto-list | `?e2e=1` | Forces list mode regardless of `view` param |

---

## localStorage Specification

| Key | Format | Details |
|---|---|---|
| Key pattern | `stillframe.tunnel.v1:{userId}` | Schema version in key for future migration |
| JSON corruption | `loadState()` catch → returns null | Falls back to fresh scatter layout (no white screen) |
| QuotaExceededError | `saveState()` catch → silent | UI continues working, positions just not persisted |
| Debounce | 300ms | Prevents excessive writes during drag/zoom |
| Timer cleanup | useEffect return | Both `saveTimerRef` and `zDebounce` cleared on unmount |

---

## Self-Audit Checklist

| Item | Status | Evidence |
|---|---|---|
| No rAF+setState frame tick | PASS | Direct DOM manipulation only during drag/pan |
| localStorage schema version | PASS | `stillframe.tunnel.v1:` in key |
| JSON corruption safe | PASS | `loadState()` try/catch → null → fresh state |
| QuotaExceeded handled | PASS | `saveState()` try/catch → silent continue |
| Listener cleanup (pointermove) | PASS | TunnelCardWrapper:111-113, TunnelCanvas:104-106 |
| Listener cleanup (keydown) | PASS | TunnelCanvas:139 |
| Debounce timer cleanup | PASS | useEffect cleanup in useTunnelStore + TunnelCardWrapper |
| touch-action on cards | PASS | `touch-action: none` in tunnel.css `.tunnel-card` |
| view=list / view=tunnel | PASS | viewMode derivation in page.tsx |
| e2eMode auto-list | PASS | `e2eMode ? "list" : (searchParams.get("view") \|\| "tunnel")` |
| 5px drag threshold | PASS | `DRAG_THRESHOLD = 5` |
| Interactive element guard | PASS | `INTERACTIVE_SELECTOR` checks `button,a,input,textarea,...` |

---

## Verification Results

### Build
```
npm run build → ✓ Compiled successfully (0 errors, 0 type errors)
Next.js 16.1.6 (Turbopack), /app → static ○
```

### Lint
```
npm run lint → SKIP (ESLint config not present at project root — pre-existing issue)
```

### E2E Tests — tunnel.spec.ts (NEW)
```
npx playwright test e2e/tunnel.spec.ts → 4 passed (6.9s)

✓ tunnel view renders 3D canvas by default (3.0s)
✓ ?view=list shows the original grid layout (2.9s)
✓ tunnel or auth gate renders for non-e2e mode (3.3s)
✓ view=list fallback preserves card interactivity (3.2s)
```

### E2E Tests — smoke.spec.ts (EXISTING, regression check)
```
npx playwright test e2e/smoke.spec.ts → 5 passed (8.3s)

✓ LP CTAs are visible and clickable (1.0s)
✓ /app grid is aligned and has no horizontal overflow (3.2s)
✓ memo opens and persists after reload (4.7s)
✓ memo dialog keyboard a11y (3.8s)
✓ __E2E_ALLOWED__ is sealed (2.7s)
```

### Visual Evidence
```
scripts/visual_evidence.mjs → NOT PRESENT (no visual evidence script in repo)
```

---

## Summary

表示レイヤーのみの差し替え。CSS perspective + translate3d による3D浮遊カード空間を `/app` のデフォルトビューとして導入。既存グリッドは `?view=list` で完全に保持。E2Eモードでは自動的にリストビューに切り替わるため、既存の5本のsmokeテストに影響なし。新規4本のE2Eテストも全パス。

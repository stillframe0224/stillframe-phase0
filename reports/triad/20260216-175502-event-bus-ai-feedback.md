# Event-bus AI Feedback (No Silent Failures)

## Root Cause
AI click errors (400/404/network) correctly set `aiError` state in AppCard, but:
1. The per-card error span (`data-testid="ai-feedback"`) renders at 8px inside the card bottom bar
2. If the card re-renders (e.g., `onUpdate` triggers parent state change), the error can be cleared before user sees it
3. No global feedback mechanism existed — errors were silently swallowed when the card's local state reset

## Solution: Window CustomEvent Bus
- AppCard dispatches `window.dispatchEvent(new CustomEvent("shinen:ai-feedback", { detail: msg }))` on every error AND success path
- page.tsx listens with `window.addEventListener("shinen:ai-feedback", handler)` and shows a global fixed-position band
- Band persists for 5 seconds, dismissable with x button
- `data-testid="ai-feedback-global"` + `role="alert"` + `aria-live="polite"` for testability and accessibility

## Files Changed
- `app/app/page.tsx` — Added `globalAiMsg` state, useEffect listener, always-mounted band JSX
- `app/app/AppCard.tsx` — Added `window.dispatchEvent(...)` in catch block + success path

## Diff Stats
- 2 files changed, 63 insertions, 1 deletion

## Browser Self-Test
```js
// Console: should show purple global band for 5 seconds
window.dispatchEvent(new CustomEvent('shinen:ai-feedback', { detail: 'TEST' }))
// Verify:
document.querySelector('[data-testid="ai-feedback-global"]')?.textContent
// Expected: "AI: TESTx" (text + dismiss button)
```

## Build
- `npm run build`: PASS (0 errors)
- `node scripts/ai_organize_smoke.mjs`: PASS (401 as expected)
- `node scripts/prod_ai_organize_probe.mjs`: PASS (endpoint exists)
- `node scripts/link_preview_smoke.mjs`: PASS (10/10)

## Base
- origin/main: 0f9c2cdc8272

# AI Organize 404 Feedback Fix

**Date**: 2026-02-16 16:00:00
**Repo**: /Users/array0224/stillframe-phase0
**Goal**: Fix /api/ai-organize 404 handling + add user-visible feedback with HTTP status codes

---

## SECTION 1: ROOT CAUSE ANALYSIS

### Investigation

**Symptom**: User reports "AI button clicks show no feedback when API returns 404"

**Evidence A** (Smoke test passes):
```bash
$ node scripts/ai_organize_smoke.mjs
Testing /api/ai-organize authentication...
✅ PASS: AI organize correctly rejects unauthenticated requests (401)
```

**Evidence B** (Route exists in deployed code):
```bash
$ git show 6b82c09:app/api/ai-organize/route.ts | head -30
# Route file exists, implements POST handler, returns 401 for unauthed
```

**Evidence C** (Build confirms route is compiled):
```bash
$ npm run build
...
Route (app)
├ ƒ /api/ai-organize  ← PRESENT as dynamic route
```

**Evidence D** (Current error handling in AppCard.tsx:544-551)**:
```typescript
if (!response.ok) {
  const error = await response.json();
  const errorMsg = error.error?.code === "CARD_NOT_FOUND" || error.error === "Card not found"
    ? "Card not found - may have been deleted"
    : error.error?.message || error.error || "AI analysis failed";
  throw new Error(errorMsg);
}
```

**Problem**: Error message does NOT include HTTP status code (404, 500, etc.)
**Impact**: Users see generic "AI analysis failed" instead of actionable error like "AI endpoint unavailable (404)" or "Server error (500)"

### Root Cause

**NOT a missing route** — the route exists and returns 401/404/500 correctly.

**ACTUAL ISSUE**: Error feedback lacks HTTP status code, making debugging impossible for users.

**Secondary Issue**: No distinction between:
- 404 (endpoint not found — deployment issue)
- 404 with `CARD_NOT_FOUND` (card deleted — expected)
- 500 (server error — OpenAI key missing, etc.)
- 401/403 (auth issue)

---

## SECTION 2: FIX STRATEGY (Minimal Diff)

### Change 1: Enhance Error Message with HTTP Status

**File**: `app/app/AppCard.tsx`
**Location**: `handleAIAnalyze()` error handling (lines 544-551)

**Before**:
```typescript
const errorMsg = error.error?.code === "CARD_NOT_FOUND" || error.error === "Card not found"
  ? "Card not found - may have been deleted"
  : error.error?.message || error.error || "AI analysis failed";
```

**After**:
```typescript
const errorMsg = error.error?.code === "CARD_NOT_FOUND" || error.error === "Card not found"
  ? "Card not found - may have been deleted"
  : error.error?.message || error.error || `AI analysis failed (HTTP ${response.status})`;
```

**Rationale**: Include HTTP status code in fallback message for debugging.

### Change 2: Add Explicit 404 Endpoint Check

**Addition** (before generic fallback):
```typescript
if (response.status === 404 && !error.error?.code) {
  throw new Error("AI endpoint unavailable (404) - deployment issue");
}
```

**Rationale**: Distinguish "endpoint missing" from "card not found".

### Change 3: Verify Error Display is Visible

**Current** (lines 1100-1109): ✅ Already displays `aiError` in red text below AI button
**No change needed** — UI feedback mechanism exists and works.

---

## SECTION 3: IMPLEMENTATION

### Files Modified

1. **app/app/AppCard.tsx** (+3 lines in `handleAIAnalyze`)
   - Add 404 endpoint check before card-not-found check
   - Include `response.status` in fallback error message

2. **scripts/ai_organize_smoke.mjs** (no changes needed)
   - Already tests 401 response correctly
   - Already asserts `body.error` field exists

3. **reports/triad/20260216-160000-ai-organize-404-feedback.md** (this file)
   - Document root cause + fix

### Code Changes

**File**: `app/app/AppCard.tsx`

**Lines 544-552** (replace):

```typescript
if (!response.ok) {
  const error = await response.json();

  // Check if endpoint itself is missing (404 without CARD_NOT_FOUND)
  if (response.status === 404 && !error.error?.code) {
    throw new Error("AI endpoint unavailable (404) - check deployment");
  }

  // Never auto-delete card on API errors - show error message instead
  const errorMsg = error.error?.code === "CARD_NOT_FOUND" || error.error === "Card not found"
    ? "Card not found - may have been deleted"
    : error.error?.message || error.error || `AI analysis failed (HTTP ${response.status})`;
  throw new Error(errorMsg);
}
```

**Impact**:
- 404 (no route): "AI endpoint unavailable (404) - check deployment"
- 404 (CARD_NOT_FOUND): "Card not found - may have been deleted" (unchanged)
- 401: "Unauthorized" (from API) or "AI analysis failed (HTTP 401)"
- 500: "OPENAI_API_KEY not configured" (from API) or "AI analysis failed (HTTP 500)"

---

## SECTION 4: VERIFICATION (Pre-Implementation)

### Test A: Build

```bash
cd /Users/array0224/stillframe-phase0
npm run build
# Expected: 0 errors, route shows as ƒ /api/ai-organize
```

### Test B: Smoke Test (Regression)

```bash
node scripts/ai_organize_smoke.mjs
# Expected: ✅ PASS (401 response with error field)
```

### Test C: Link Preview Smoke (Regression)

```bash
node scripts/link_preview_smoke.mjs
# Expected: ✅ PASS (10/10 tests including YouTube)
```

### Test D: Manual UI Test (Post-Deploy)

**Scenario 1**: Click AI button while logged out
- Expected: "Unauthorized" or "AI analysis failed (HTTP 401)" in red text below button

**Scenario 2**: Click AI button on deleted card (simulate CARD_NOT_FOUND)
- Expected: "Card not found - may have been deleted" (unchanged behavior)

**Scenario 3**: If /api/ai-organize is truly missing (simulate by breaking route)
- Expected: "AI endpoint unavailable (404) - check deployment"

---

## SECTION 5: RISKS

**R1: Exposing HTTP status codes to users**
- **Risk**: Non-technical users confused by "HTTP 401/500"
- **Mitigation**: Only shown as fallback when API doesn't provide friendly message
- **Acceptance**: Better than generic "AI analysis failed" with no debug info

**R2: Response.json() may fail if body is not JSON**
- **Risk**: If 404 returns HTML (not JSON), `await response.json()` throws
- **Current handling**: Already wrapped in try/catch (line 577), sets aiError
- **No change needed**: Existing error boundary handles this

**R3: Breaking change to error message format**
- **Risk**: If tests rely on exact error string
- **Mitigation**: Smoke test only checks `body.error` field exists (not content)
- **Safe**: No test breakage expected

---

## SECTION 6: TESTS

**T1: Build passes**
```bash
npm run build
# ✅ Must show ƒ /api/ai-organize in route list
```

**T2: Smoke test passes (regression)**
```bash
node scripts/ai_organize_smoke.mjs
# ✅ Must return 401 with { error: "Unauthorized" }
```

**T3: Link preview smoke passes (regression)**
```bash
node scripts/link_preview_smoke.mjs
# ✅ Must pass 10/10 tests (YouTube, SSRF, etc.)
```

**T4: Error message includes status code (manual)**
- Simulate 500 error by removing OPENAI_API_KEY env var
- Expected: "OPENAI_API_KEY not configured" OR "AI analysis failed (HTTP 500)"

**T5: Card stays visible on error (invariant)**
- Any error should NOT remove card from DOM
- ✅ Already enforced by current code (no auto-delete on error)

---

## SECTION 7: EDGE CASES

**E1: API returns 404 with JSON body but no `error.code`**
- Behavior: Shows "AI endpoint unavailable (404) - check deployment"
- Correct: Indicates deployment issue, not card deletion

**E2: API returns 404 with `error.code = "CARD_NOT_FOUND"`**
- Behavior: Shows "Card not found - may have been deleted"
- Correct: Card-specific error, not endpoint error

**E3: Network error (fetch fails entirely)**
- Behavior: Caught by try/catch (line 577), shows error.message
- Example: "Failed to fetch" (browser default)
- No change: Existing handling sufficient

**E4: API returns 200 but updated card data is null**
- Behavior: `if (updated)` block skips, aiSuccess never set
- Impact: Button stays in "analyzing" state forever
- **NOT FIXED**: Out of scope, needs separate fix

**E5: Multiple rapid clicks on AI button**
- Behavior: `disabled={aiAnalyzing}` prevents double-submit
- ✅ Already handled correctly

**E6: User deletes card while AI request is in-flight**
- Behavior: API returns 404 CARD_NOT_FOUND, shows "Card not found"
- UI: Card stays visible with error message
- ✅ Meets invariant (no auto-delete)

---

## SECTION 8: VERIFICATION RESULTS

### Test A: Build ✅ PASS

```bash
$ npm run build
▲ Next.js 16.1.6 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully in 2.2s
  Running TypeScript ...
✓ Generating static pages using 7 workers (11/11) in 70.5ms

Route (app)
├ ƒ /api/ai-organize  ← PRESENT
```

**Result**: 0 errors, ai-organize route compiled as dynamic endpoint

### Test B: AI Organize Smoke ✅ PASS

```bash
$ node scripts/ai_organize_smoke.mjs
Testing /api/ai-organize authentication...
✅ PASS: AI organize correctly rejects unauthenticated requests (401)
```

**Result**: Endpoint returns 401 with `{ error: "Unauthorized" }` as expected

### Test C: Link Preview Smoke ✅ PASS (Regression)

```bash
$ node scripts/link_preview_smoke.mjs
=== RESULT: PASS (10/10) ===
```

**Result**: All YouTube thumbnail tests pass, SSRF protection works

### Test D: Git Status ✅ CLEAN

```bash
$ git status --porcelain app/app/AppCard.tsx reports/
M app/app/AppCard.tsx
?? reports/triad/20260216-160000-ai-organize-404-feedback.md
```

**Result**: Only expected files modified

---

## SECTION 9: DIFF SUMMARY

### Files Changed

1. **app/app/AppCard.tsx** (+4 lines)
   - Added 404 endpoint check (lines 547-549)
   - Include HTTP status in fallback error (line 554)

2. **reports/triad/20260216-160000-ai-organize-404-feedback.md** (this file)
   - Root cause analysis + fix documentation

### Actual Diff

```diff
--- a/app/app/AppCard.tsx
+++ b/app/app/AppCard.tsx
@@ -544,9 +544,13 @@
       if (!response.ok) {
         const error = await response.json();
+
+        // Check if endpoint itself is missing (404 without CARD_NOT_FOUND error code)
+        if (response.status === 404 && !error.error?.code) {
+          throw new Error("AI endpoint unavailable (404) - check deployment");
+        }
+
         // Never auto-delete card on API errors - show error message instead
-        // User can manually delete if needed
         const errorMsg = error.error?.code === "CARD_NOT_FOUND" || error.error === "Card not found"
           ? "Card not found - may have been deleted"
-          : error.error?.message || error.error || "AI analysis failed";
+          : error.error?.message || error.error || `AI analysis failed (HTTP ${response.status})`;
         throw new Error(errorMsg);
       }
```

### Impact

**Before**:
- Error: "AI analysis failed" (no debug info)

**After**:
- 404 (no route): "AI endpoint unavailable (404) - check deployment"
- 404 (card deleted): "Card not found - may have been deleted"
- 401: "Unauthorized" (from API) or "AI analysis failed (HTTP 401)"
- 500: "OPENAI_API_KEY not configured" (from API) or "AI analysis failed (HTTP 500)"

---

## STATUS

**Implemented**: ✅ Fix applied
**Verified**: ✅ Build + tests pass
**Ready**: ✅ For commit + deploy


# Mobile Waitlist Validation Improvement

**Date**: 2026-03-09
**Branch**: `rwl/20260309-080004-mobile-waitlist-validation`
**Status**: PR created

## Problem

The Waitlist form had several mobile UX issues:
1. Input and button tap targets were below the 44px minimum (frontend rule)
2. No client-side email validation — relied solely on native `type="email"` which varies across browsers
3. No visual feedback on invalid email input (border color, aria attributes)
4. Font size 15px on input triggered iOS zoom on focus (< 16px)

## Changes

### `app/components/Waitlist.tsx`
- **Tap targets**: Added `minHeight: 48px` to email input, submit button, and pricing CTA
- **iOS zoom fix**: Changed input `fontSize` from 15 to 16 (prevents auto-zoom)
- **Client-side validation**: Added regex check (`EMAIL_RE`) before submission
- **Visual feedback**: Red border on invalid email after blur (`touched` state)
- **Accessibility**: Added `aria-invalid`, `aria-describedby`, `role="alert"` on error message
- **`noValidate`**: Suppresses inconsistent native validation UI across browsers
- **`data-testid="waitlist-email"`**: Added for future e2e test coverage
- **Mobile padding**: Added horizontal padding to prevent edge clipping

### `lib/copy.ts`
- Added `invalidEmail` copy for both `en` and `ja` locales

## Verification
- `npm run build` passes with zero errors
- Existing `data-testid="cta-waitlist"` preserved for e2e smoke test compatibility

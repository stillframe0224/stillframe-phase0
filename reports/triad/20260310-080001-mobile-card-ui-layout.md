# Mobile Card UI Layout Improvements

**Task ID:** 20260310-080001-mobile-card-ui-layout
**Date:** 2026-03-10
**Status:** Complete

## Summary

Improved mobile layout for SHINEN's card creation screen on narrow/notched devices.

## Changes

### InputBar.tsx
- Added `env(safe-area-inset-bottom)` support so the input bar clears iPhone home indicators and notch areas.

### MemoModal.tsx
- Added `useKeyboardOffset()` hook using `window.visualViewport` to detect iOS keyboard height.
- Modal repositions above the keyboard when it opens (switches from `center` to `flex-start` alignment with top padding).
- Smooth CSS transition on padding change.

### NavBar.tsx
- Added `useIsNarrow()` hook (viewport < 480px) for responsive behavior.
- On narrow screens: hides "Shinen" wordmark, shortens search input (100px vs 160px), hides "⌘K" hint, abbreviates layout/reset button labels.
- Added `env(safe-area-inset-top)` padding so the nav bar doesn't overlap the status bar on notched devices.
- Added `flexShrink: 1, minWidth: 0` to controls container to prevent overflow.

## Testing

- `npm run build` — passes with zero errors.
- Visual verification targets: iPhone SE (375px), iPhone 14 Pro (393px), narrow Android (360px).

## Risk

Low — CSS-only and hook-based changes with no data/API impact. All changes are additive safe-area and responsive layout adjustments.

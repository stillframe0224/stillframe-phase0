# Waitlist Success/Failure Telemetry Enhancement

**ID**: 20260219-080700-waitlist-success-telemetry
**Status**: Done
**Branch**: `rwl/20260219-080700-waitlist-success-telemetry`

## Problem

Waitlist telemetry events lacked structured destination and HTTP status fields,
making it hard to distinguish success vs failure paths and diagnose webhook issues
in Vercel logs.

## Changes

**File**: `app/components/Waitlist.tsx`

- Replaced generic `waitlist_submit_result` with explicit `waitlist_submit_success`
  event that fires only on the happy path (includes `destination` + `status`)
- Added `status` field (HTTP status code) to `waitlist_submit_failed` event
- Added success tracking for mailto fallback path (`destination: "mailto"`)
- Removed PII (`email`) from result/failure events — only the initial
  `waitlist_submit` event retains it for funnel analysis

## Event Schema (after)

| Event | Props | When |
|---|---|---|
| `waitlist_submit` | `email`, `destination` | Form submitted |
| `waitlist_submit_success` | `destination`, `status` (webhook only) | Webhook 2xx or mailto redirect |
| `waitlist_submit_failed` | `destination`, `status`, `reason` | Webhook non-2xx, network error, or missing dest |

## Verification

- `npm run build` passes with zero errors

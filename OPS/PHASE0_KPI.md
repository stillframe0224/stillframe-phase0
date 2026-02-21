# Phase0 KPI Scoreboard

## What it is

A daily-updated GitHub Issue that shows Phase0 Go/No-Go metrics at a glance.
No PR spam — the same issue body is overwritten each run.

## Thresholds (Go / No-Go)

| Metric | Target | Source |
|--------|--------|--------|
| Waitlist signups | 300 | External webhook (`NEXT_PUBLIC_WAITLIST_POST_URL`) |
| Payment intent | 30 | Gumroad (`NEXT_PUBLIC_GUMROAD_PRODUCT_URL`) |
| Pre-orders | 5 | Gumroad |

## Data sources

### Available server-side (Supabase `cards` table)

- `total_cards` — total rows in `cards`
- `distinct_users` — distinct `user_id` values
- `cards_7d` — cards created in the last 7 days
- `cards_1d` — cards created in the last 24 hours

### External (not queryable server-side yet)

- `waitlist_total` — emails collected via external webhook. Returns `null`.
  To populate: integrate webhook provider API, or update Issue manually.
- `payment_intent` — tracked via Gumroad. Returns `null`.
  To populate: integrate Gumroad API, or update Issue manually.
- `preorders` — tracked via Gumroad. Returns `null`.
  To populate: integrate Gumroad API, or update Issue manually.

## How it works

1. **API endpoint**: `GET /api/phase0-kpi` returns JSON with counts (no PII).
2. **GitHub Action**: `.github/workflows/phase0_kpi_scoreboard.yml`
   - Runs daily at 19:13 UTC (04:13 JST)
   - Fetches KPI JSON from production
   - Renders markdown table with Go/No-Go status
   - Finds or creates issue titled "Phase0 KPI Scoreboard"
   - Overwrites the issue body

## Run manually

```bash
# Trigger the workflow
gh workflow run phase0-kpi-scoreboard -R stillframe0224/stillframe-phase0

# Check latest runs
gh run list -R stillframe0224/stillframe-phase0 \
  --workflow phase0_kpi_scoreboard.yml --limit 3

# Find the issue
gh issue list -R stillframe0224/stillframe-phase0 \
  --search "Phase0 KPI Scoreboard" --json number,title,url
```

## Test the API locally

```bash
curl -s http://localhost:3000/api/phase0-kpi | jq .
```

## Extending

To add waitlist/payment data:

1. **Waitlist**: If the webhook provider has an API, add a fetch in the API route
   or in the GitHub Action (curl the provider, merge counts into the issue body).
2. **Gumroad**: Use Gumroad API (`https://api.gumroad.com/v2/products`) with
   a `GUMROAD_ACCESS_TOKEN` secret. Fetch sales count in the Action step.

## SSOT pointers

- API: `app/api/phase0-kpi/route.ts`
- Action: `.github/workflows/phase0_kpi_scoreboard.yml`
- This doc: `OPS/PHASE0_KPI.md`

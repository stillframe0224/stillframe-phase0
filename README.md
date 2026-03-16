# force rebuild 2026年 2月14日 土曜日 06時03分46秒 JST

## Observability (Phase0)

### Card Error Tracking

Track OGP fetch failures, HTTP errors, and DNS blocks.

**Setup**:
1. Run migration: `supabase migration up`
2. Errors are automatically logged to `card_errors` table

**Dashboard**: `/metrics/errors` (requires authentication)

**Error Types**: `ogp_fetch_failed`, `http_error`, `dns_blocked`

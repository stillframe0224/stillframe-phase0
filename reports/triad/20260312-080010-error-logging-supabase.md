# Supabaseエラーのログ強化

- **date**: 2026-03-12
- **status**: done
- **type**: feature

## Summary

Supabase操作のエラーログを構造化。エラー種別（auth/database/storage/network/validation）、ユーザーID、タイムスタンプをJSON形式でconsole.errorに出力し、Vercel Function Logsで検索・分析可能にした。

## Changes

### New file
- `lib/supabase/logger.ts` — 構造化エラーロガー
  - `classifyError()`: エラーメッセージ・コードから種別を自動分類
  - `logSupabaseError()`: JSON構造化ログ出力（level, category, operation, message, userId, timestamp, code, details）
  - `logSupabaseWarn()`: 非致命的エラー用の警告ログ

### Modified files (logger integration)
- `app/app/shinen/lib/supabase-cards.ts` — fetchCards, insertCard, updateCard, deleteCards, uploadFile の全操作にログ追加
- `app/api/ai-organize/route.ts` — auth, fetchCard, updateCard エラーにログ追加。`catch (error: any)` → `catch (error: unknown)` に型修正
- `app/api/phase0-kpi/route.ts` — totalCards, distinctUsers クエリエラーにログ追加
- `app/api/metrics/preview/route.ts` — createClient, query エラーにログ追加
- `app/api/db-schema-check/route.ts` — createClient エラーにログ追加
- `app/api/og-image/route.ts` — fetch失敗時のcatchにログ追加
- `app/auth/callback/route.ts` — exchangeCodeForSession エラーにログ追加
- `lib/supabase/middleware.ts` — getUser() 認証エラーにログ追加
- `app/app/page.tsx` — クライアントサイド getUser() エラーに警告ログ追加

## Log format

```json
{
  "level": "error",
  "category": "database",
  "operation": "insertCard",
  "message": "duplicate key value violates unique constraint",
  "userId": "uuid-here",
  "timestamp": "2026-03-12T22:30:00.000Z",
  "code": "23505"
}
```

## Error categories

| Category | Detection criteria |
|----------|-------------------|
| auth | code starts with "auth", message contains "jwt"/"session"/"unauthorized" |
| database | PostgreSQL error codes (5-digit), PGRST codes, constraint violations |
| storage | message contains "storage"/"bucket"/"upload" |
| network | message contains "fetch"/"timeout"/"abort"/"network" |
| validation | message contains "invalid"/"required"/"missing" |
| unknown | fallback |

## Build

`npm run build` — passed with zero errors.

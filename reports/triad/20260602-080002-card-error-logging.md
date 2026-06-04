# Task: カード作成失敗時のエラーログ永続化
**ID**: 20260602-080002-card-error-logging
**Date**: 2026-06-04 JST

## 変更ファイル
- `/Users/array0224/stillframe-phase0/lib/supabase/errorLog.ts`
- `/Users/array0224/stillframe-phase0/supabase/migrations/005_error_logs.sql`
- `/Users/array0224/stillframe-phase0/app/app/shinen/lib/supabase-cards.ts`
- `/Users/array0224/stillframe-phase0/app/app/shinen/hooks/useOgThumbnails.ts`
- `/Users/array0224/stillframe-phase0/scripts/tests/card_error_logging_contract.test.mjs`
- `/Users/array0224/stillframe-phase0/package.json`

## 実装内容
- `public.error_logs` テーブルを追加し、RLS で本人ログの insert/select を制限。
- `logCardError` を追加し、Supabase 未設定・ログ書き込み失敗時は呼び出し元へ影響しない best-effort 方式にした。
- `insertCard` の未認証・Supabase insert 失敗を `error_logs` に記録し、既存どおり元エラーを再スロー。
- OGP/link-preview fetch 失敗を `og_fetch_failed` として記録し、URL 本文ではなく `domain` と `cardId` だけを context に保存。
- 回帰用の静的契約テストを `test:unit` に追加。

## Verification
```text
npm run lint
PASS: lint skipped: Next.js 16 has no next lint command and no eslint flat config is present

npm run test:unit
PASS: tests 21, pass 20, skipped 1, fail 0

npm run build
PASS: Next.js build completed, 13/13 static pages generated
```

## Codex: RISKS
- `error_logs` への書き込みは best-effort のため、Supabase 自体が未設定・通信不能・RLS 不一致の場合はユーザー操作を妨げず記録だけ失敗する。
- OGP fetch の既存 `console.warn` は raw URL を含む。永続化する context には raw URL を保存しない。

## Codex: TESTS
- `npm run lint`
- `npm run test:unit`
- `npm run build`

## Codex: EDGE
- 未認証時の card insert/auth failure も `user_id=null` で insert 可能。
- ログ書き込み失敗は swallow し、カード作成失敗の元エラー再スロー挙動は維持。
- OGP fetch の AbortError は従来どおりログ対象外。

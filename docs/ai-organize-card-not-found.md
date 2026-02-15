# Fix: AI Organize — \"Card not found\"

## What changed
AI Organize 実行時にカードが存在しないケースで、ユーザーに生の \"Card not found\" を見せていた問題を修正した。

## User impact
- 以前: UIに \"Card not found\" がそのまま表示され、原因が不明で混乱する
- 以後: 「削除済み / 未作成の可能性」を明示したメッセージを表示し、Open等の導線も安全に扱える

## Root cause
`/api/ai-organize` がカード未存在時に `404 { \"error\": \"Card not found\" }` を返し、
UI側（`AppCard.tsx`）がこの文字列をそのまま表示していた。

未存在の原因例:
- DBから削除済み
- 作成に失敗して存在しない
- race（UI stateが残っている等）

## Changes

### API (`app/api/ai-organize/route.ts`)
404 を構造化エラーに変更:
- Before: `{ \"error\": \"Card not found\" }`
- After: `{ \"error\": { \"code\": \"CARD_NOT_FOUND\", \"message\": \"Card not found\" } }`

### UI (`app/app/AppCard.tsx`)
- `CARD_NOT_FOUND` を検知してユーザー向けに置換:
  - 表示: **\"Card was deleted or not created\"**
- 旧フォーマット（string error）も扱えるように後方互換を維持

### Smoke Test Note (`scripts/ai_organize_smoke.mjs`)
- 旧/新レスポンス形式が混在しても検証が通ることをコメントで明記

## Compatibility
- 旧形式の `error: string` と新形式の `error: {code,message}` の両方をハンドリングするため後方互換あり
- ただしクライアント実装が “構造化エラー前提のみ” の場合は注意（該当なし想定）

## Verification
- `npm run build` が成功すること
- `node scripts/ai_organize_smoke.mjs` が成功すること
- UI上でカード未存在時に \"Card was deleted or not created\" が表示されること

## Rollback
- APIの構造化エラー返却を元に戻す（ただしUI側は互換ハンドリングがあるため即時致命にはなりにくい）
- UIのメッセージ置換を元に戻す（ユーザー体験が悪化）

## Files touched
- `app/api/ai-organize/route.ts`
- `app/app/AppCard.tsx`
- `scripts/ai_organize_smoke.mjs`

# 20260225 Saveflow Guard

## 何を防ぐか
- URL入力がプレーンノート化（`type:0/2/4` など）して保存される不整合
- X ログイン壁の汎用画像（`abs.twimg.com/.../og/image.png`）を保存してしまう不整合

## ルール（保存時ガード）
- `normalizeOnSave(cardDraft)` を追加し、保存直前に全カード草案へ適用。
- 返り値: `{ card, reasons }`

### A) URLノート化防止
- 条件:
  - `type != 8` かつ (`source.url` がある、または本文が URL 単体)
- 対応:
  - `type = 8`
  - `source.url` を正本化（既存 `source.url` 優先、なければ本文 URL）
  - `source.site` を補完
  - reason: `guard:type8_source`

### B) X汎用画像の保存禁止
- 条件:
  - `thumbnail_url` または `media.url/posterUrl/thumbnail` が汎用 X 画像パターンに一致
- 対応:
  - 汎用画像を破棄（画像カードは `media` を除去、embed は poster/thumbnail を除去）
  - reason: `guard:drop_generic_x_thumb`

### C) embed最低整合（壊さない）
- 条件:
  - `media.kind=embed`（または `media.type=embed`）で `embedUrl` 欠損
- 対応:
  - 推測で埋めない（保存時に壊さない）
  - reason: `guard:embed_missing_url`

## 冪等性
- `normalizeOnSave` を2回適用しても2回目以降は同一結果（追加変更なし）。

## 実装箇所
- `app/app/shinen/lib/selfHealMigration.mjs`
  - `normalizeOnSave` を追加（既存 migration と同一パターン群を再利用）
- `app/app/shinen/ShinenCanvas.tsx`
  - 新規保存経路（URL入力、clip receiver、bookmarklet auto-capture、file upload）で保存直前に `normalizeOnSave` を適用
  - debug時のみ `save_guard_applied` diagnostics を記録

## Tests & PASS
- `npm run test:unit` ✅
- `node --test scripts/tests/shinen_x_ig_media.test.mjs` ✅
- `node --test scripts/tests/shinen_thumb_render_modes.test.mjs` ✅
- `node --test scripts/tests/shinen_link_open_amazon.test.mjs` ✅
- `node --test scripts/tests/shinen_selfheal_migration.test.mjs` ✅
- `npm run build` ✅
- `bash scripts/tests/test_codex_headings.sh` ✅
- `bash scripts/tests/test_design_tokens.sh` ✅

## リスク / ロールバック
- リスク:
  - URL単体判定を厳格化しており、`URL + メモ` 入力は自動昇格しない（意図どおり安全側）。
- ロールバック:
  1. `ShinenCanvas.tsx` の `applySaveGuards` 呼び出しを撤去
  2. `selfHealMigration.mjs` の `normalizeOnSave` を戻す
  3. 追加テストを戻す

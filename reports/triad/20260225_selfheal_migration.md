# 20260225 Self-Heal Migration

## 対象不整合
- A) URL入力カードが過去不具合でプレーンノート化
  - `type != 8` かつ `source.url` がある、または本文が URL 単体
- B) X ログイン壁由来の汎用画像
  - `abs.twimg.com/.../og/image.png` が `media.url / thumbnail / poster` に保存
- C) `media/source/type` の明確な破損
  - `media.kind=embed`（または `media.type=embed`）なのに `embedUrl` が欠損

## 修復ルール（誤爆回避）
- `migrateCard(card)` を純関数で実装し、明確に壊れている場合のみ修復。
- A) URLノート正規化:
  - `type=8` へ統一、`source.url` を URL SSOT に設定。
  - プレビュー不足時は `enqueue_unfurl` action を積む。
- B) 汎用X画像破棄:
  - 汎用パターン一致時はサムネを削除（画像カードは `media` 自体を除去）。
  - `enqueue_unfurl` action を積み再取得対象化。
- C) embed不整合:
  - URL から embed を安全に推論可能なら `embedUrl` を補完。
  - 補完不能ならカード本体は壊さず `enqueue_unfurl` のみ積む。

## 冪等・上限・バージョン管理
- 冪等:
  - 同カードへ再適用時、2回目以降は `changed=false` になる。
- 実行上限:
  - 1起動あたり `SELFHEAL_MIGRATION_MAX_PER_RUN = 30` 件まで。
  - 残件は次回起動へ繰り越し。
- バージョン:
  - `localStorage["shinen_migration_selfheal_v20260225"] = "1"` で実行済み管理。
  - debug時のみ `localStorage["shinen_migration_selfheal_force"]="1"` で再実行可能。

## Diagnostics（bundleで確認）
- 追加イベント:
  - `migration_start`
  - `migration_fix`
  - `migration_action_enqueued`
  - `migration_done`
- 主要情報:
  - `cardId`, `reasons`, `before/after`要約, `actionCount`, `remainingCount`
- debug時の bundle export (`shinen-export-bundle-*.jsonl`) に同梱される。

## Tests
- `npm run test:unit` ✅
- `node --test scripts/tests/shinen_selfheal_migration.test.mjs` ✅
- `node --test scripts/tests/shinen_x_ig_media.test.mjs` ✅
- `node --test scripts/tests/shinen_thumb_render_modes.test.mjs` ✅
- `node --test scripts/tests/shinen_link_open_amazon.test.mjs` ✅
- `npm run build` ✅
- `bash scripts/tests/test_codex_headings.sh` ✅
- `bash scripts/tests/test_design_tokens.sh` ✅

## リスク / ロールバック
- リスク:
  - 起動時に軽量な unfurl 再取得（最大30件）が走るため、初回のみ I/O が増える。
  - 補修条件は厳密化しており、曖昧なカードは変更しない方針。
- ロールバック:
  1. `app/app/shinen/lib/selfHealMigration.mjs` と `ShinenCanvas.tsx` の自己修復呼び出しを戻す。
  2. `scripts/tests/shinen_selfheal_migration.test.mjs` を削除/巻き戻し。
  3. 必要なら `localStorage` の `shinen_migration_selfheal_v20260225` キーを削除して再評価。

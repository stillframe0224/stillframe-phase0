# SHINEN triad report — 2026-02-24 (autodiag)

## Background
- これまでは再発時に「URL / cardデータ / 失敗種別」を人間入力に依存していた。
- 再現手順が不足すると根因切り分けが止まりやすいため、入力待ちをやめてクライアント側で自動採取する方式に変更した。

## Added diagnostics
- `open_click`
  - 記録タイミング: `ThoughtCard` の `↗ open` に対する `onClickCapture`
  - 主フィールド: `cardId`, `domain`, `link_url`, `thumbnail_url`
  - `extra`: `clickDefaultPrevented`, `pointerDownDefaultPrevented`, `isHovered`
- `thumb_error`
  - 記録タイミング: サムネ `img` の `onError`（image / youtube thumbnail）
  - 主フィールド: `cardId`, `domain`, `link_url`, `thumbnail_url`
  - `extra`: `src`, `proxy_url`, `mediaType`

## Storage / export
- 実装: `app/app/shinen/lib/diag.ts` (`diag.mjs` 実体)
- 保存方式:
  - localStorage key: `shinen_diag_v1`
  - ring buffer: 最大200件（古い順に破棄）
  - 形式: 配列で保持、export時は1行1JSONのJSONL
- export:
  - 既存 `Export`（cards JSONL）に統合: debug時のみ `diagnostics.jsonl` も同時に出力
  - debug時の右下パネルから `export diagnostics` 単体出力も可能

## Debug mode / build stamp
- debug ON条件:
  - URLクエリ `?debug=1` または localStorage `shinen_debug=1`
- debug OFF:
  - URLクエリ `?debug=0` または localStorage `shinen_debug` を削除
- 表示内容（debug時のみ）:
  - `/api/version` の sha（取得不可時は `package.json` version）
  - 目的: 「修正済みだが古いデプロイを見ていた」を画面上で即判別

## Tests
- 追加/更新:
  - `scripts/tests/shinen_link_open_amazon.test.mjs`
    - `open_click` / `thumb_error` の定義存在チェック（`ThoughtCard.tsx`）
    - diag ring buffer cap / JSONL export / required fields
    - debug flag判定（query / storage）
    - 既存Amazon抽出/ヘッダテストは維持
- 実行結果:
  - `npm run test:unit` PASS
  - `node --test scripts/tests/shinen_link_open_amazon.test.mjs` PASS
  - `npm run build` PASS
  - `bash scripts/tests/test_codex_headings.sh` PASS
  - `bash scripts/tests/test_design_tokens.sh` PASS

## Risk & rollback
- Risk:
  - URL/thumbnail URL が診断ログに入るため、取り扱いはローカル保持・手動export前提。
  - 外部送信は実装していない（ダウンロードのみ）。
- Rollback:
  1. `git revert <autodiag_commit_sha>`
  2. `npm run test:unit && npm run build` で復帰確認

## Notes
- `__selftest` ルート/e2eは任意要件のため今回は未追加。
- 根因確定に必要な3点（URL/card/failure type）は `diagnostics.jsonl` から自動採取可能にした。

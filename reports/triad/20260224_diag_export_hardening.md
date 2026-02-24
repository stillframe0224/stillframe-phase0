# SHINEN triad report — 2026-02-24 (diag export hardening)

## Symptoms
- `shinen-export-*.jsonl` だけ生成され、`diagnostics*.jsonl` が欠損するケースがあった。
- cards JSONL に URL 情報が無い場合、再発解析が `diagnostics` 欠損でブロックされた。

## Root cause
- debug時の通常 export が cards と diagnostics の複数ダウンロードだったため、ブラウザ設定（多重DLブロック）で2本目が落ちる余地があった。
- diagnostics出力形式がイベント配列のみで、0件時に実質空ファイルとなり得た。
- `open_click` / `thumb_error` に root-cause 再現に必要な `cardSnapshot` が常時同梱されていなかった。

## Fix
- `app/app/shinen/lib/diag.mjs`
  - `buildDiagnosticsRecords` / `buildDiagnosticsJSONL` を追加し、0件でも必ず `{"kind":"diag_meta","events":0,...}` を出力。
  - `buildDebugBundleJSONL` を追加し、`meta -> card -> diag_meta -> diag...` の単一JSONLを生成。
  - `downloadDebugBundleJSONL` を追加し、debug通常exportを1ファイルに統合。
  - diagnostics単独DLは `shinen-diagnostics-<ts>.jsonl` を常時生成（0件でも生成）。
- `app/app/shinen/ShinenCanvas.tsx`
  - debug時の通常 `Export` を単一ファイル `shinen-export-bundle-<ts>.jsonl` に変更。
  - debug HUD の `export diagnostics` は単独1ファイル出力に固定。
  - 例外時は `console.error` + debug HUD 内に `export failed: <reason>` を表示。
- `app/app/shinen/ThoughtCard.tsx`
  - `open_click` / `thumb_error` 記録に `extra.cardSnapshot` を必須同梱:
    - `cardId`, `domain`, `link_url`, `thumbnail_url`, `title`, `kind`

## Tests
- 追加/更新: `scripts/tests/shinen_link_open_amazon.test.mjs`
  - 0件時でも diagnostics export が `diag_meta` を含むこと。
  - `open_click` export に `cardSnapshot.link_url` が含まれること。
  - `thumb_error` export に `cardSnapshot.thumbnail_url` が含まれること。
  - debug bundle export が単一JSONLで `meta/card/diag` 順を満たすこと。
- 実行結果:
  - `npm run test:unit` PASS
  - `node --test scripts/tests/shinen_link_open_amazon.test.mjs` PASS
  - `npm run build` PASS
  - `bash scripts/tests/test_codex_headings.sh` PASS
  - `bash scripts/tests/test_design_tokens.sh` PASS

## Risk
- diagnosticsには URL 情報が含まれるため取り扱い注意（ローカル保存/手動exportのみ）。
- 外部送信は実装していない。

## Rollback
1. `git revert <this-commit-sha>`
2. `npm run test:unit && npm run build`
3. debug export で `shinen-export-bundle-*.jsonl` / `shinen-diagnostics-*.jsonl` が復元前仕様へ戻ることを確認

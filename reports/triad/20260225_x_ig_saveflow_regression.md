# 2026-02-25 X/IG save-flow regression follow-up

## Symptoms
- X / Instagram URLを保存しても `type 8` のクリップカードにならず、プレーンテキストカードとして保存される。
- `source` / `media` が付かないため `useOgThumbnails` が走らず、画像・embed・再生が一切付与されない。
- 既存の X login-wall 由来画像を拾うケースで、汎用画像を採用してしまう余地が残っていた。

## Root cause
- `ShinenCanvas.addThought` が URL 文字列を解釈せず、常にランダム `type(0-7)` のノートカードを作成していた。
- `xigMedia` の候補選択が「負のスコアでも1位を採用」だったため、ロゴしかない場合に誤採用され得た。

## Fix
- `app/app/shinen/ShinenCanvas.tsx`
  - `normalizeMaybeUrl(input)` を追加して URLテキストを正規化。
  - `addThought` で URL 判定時は `type: 8` のクリップカードを作成し、`source.url/site` を必ず付与。
  - URLが `instagram.com/reel|tv` の場合は初期 `media.kind="embed"` を付与（再生導線を即時確保）。
  - URL非該当は従来通りテキストカード作成。
- `app/api/link-preview/xigMedia.mjs`
  - `selectBestImageCandidate` を強化し、`score <= 0` の候補は採用しない（ロゴ/アイコンのみの誤採用を防止）。
  - X login wall 検知語彙に `See what's happening` / `Join X today` を追加。
- `scripts/tests/shinen_x_ig_media.test.mjs`
  - login wall 断片で `bestImage=null` を追加検証。
  - `ShinenCanvas` に URL入力→`type 8 + source` 昇格ロジックが存在することを静的回帰テスト化。

## Tests
```bash
npm run test:unit
node --test scripts/tests/shinen_x_ig_media.test.mjs
node --test scripts/tests/shinen_thumb_render_modes.test.mjs
node --test scripts/tests/shinen_link_open_amazon.test.mjs
npm run build
bash scripts/tests/test_codex_headings.sh
bash scripts/tests/test_design_tokens.sh
```

All PASS.

## Risk & rollback
- Risk:
  - URL判定の正規表現が将来の特殊URL形式を取りこぼす可能性。
  - `score > 0` 閾値で、稀に有効画像が `0` 点扱いなら `null` 返却になる可能性。
- Rollback:
  1. `ShinenCanvas.tsx` の `normalizeMaybeUrl` 分岐を戻し、従来 addThought 実装へ復帰。
  2. `xigMedia.mjs` の `selectBestImageCandidate` 閾値と login wall 判定語彙を差し戻し。
  3. `scripts/tests/shinen_x_ig_media.test.mjs` の追記テストを削除。

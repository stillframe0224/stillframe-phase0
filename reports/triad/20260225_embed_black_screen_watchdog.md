# 20260225 Embed Black Screen Watchdog

## Symptoms
- X/Instagram などの embed 再生で、iframe が黒画面のまま復帰しないケースがあった。
- onLoad が来ない経路では UI が待機状態に留まり、利用者が次の行動を取りづらかった。

## Root cause
- embed 再生に `loading -> loaded/timeout` の監視状態がなく、`iframe onLoad` 未到達時のタイムアウト制御が未実装だった。
- 失敗時の明示フォールバック導線（外部リンク/再試行）と、原因追跡用の診断イベントが不足していた。

## Fix
- `app/app/shinen/lib/embedWatchdog.mjs` を追加。
  - `startEmbedLoad / completeEmbedLoad / isEmbedTimedOut / timeoutEmbedLoad` を実装。
  - 既定タイムアウト 7000ms。
- `app/app/shinen/ThoughtCard.tsx` の embed UI を拡張。
  - play で `embed_load_start` を記録し watchdog 開始。
  - `iframe onLoad` で `embed_load_ok` を記録し watchdog 停止。
  - タイムアウト時は `embed_load_timeout` を記録し、iframe を隠して poster + フォールバック UI を表示。
  - フォールバック UI はカード内のみ表示（常時 open UI は追加しない）。
    - `外部で開く` (`data-open-link="1"`, stopPropagation)
    - `再試行`
  - `外部で開く` で `embed_open_external`、再試行で `embed_retry` を記録。
- `scripts/tests/shinen_embed_watchdog.test.mjs` を追加。
  - watchdog 状態遷移
  - diagnostics 出力
  - timeout fallback UI の静的検証

## Tests
- `npm run test:unit` ✅
- `node --test scripts/tests/shinen_embed_watchdog.test.mjs` ✅
- `node --test scripts/tests/shinen_x_ig_media.test.mjs` ✅
- `node --test scripts/tests/shinen_thumb_render_modes.test.mjs` ✅
- `node --test scripts/tests/shinen_link_open_amazon.test.mjs` ✅
- `npm run build` ✅
- `bash scripts/tests/test_codex_headings.sh` ✅
- `bash scripts/tests/test_design_tokens.sh` ✅

## Risk & rollback
- Risk:
  - provider 側仕様やブラウザ制限で iframe 自体が表示できないケースは残る。
  - ただし timeout 後は必ず poster 復帰 + 外部オープン導線で閉塞は回避できる。
- Rollback:
  1. `app/app/shinen/ThoughtCard.tsx` の embed watchdog/fallback 部分を元に戻す。
  2. `app/app/shinen/lib/embedWatchdog.mjs` を削除。
  3. `scripts/tests/shinen_embed_watchdog.test.mjs` を削除または該当ケースを無効化。

# Task: OGP画像取得失敗時のフォールバック処理を追加（グレースケール代替画像表示）
**ID**: 20260312-080000-ogp-fetch-error-handling
**Date**: 2026-03-12 08:00 JST
**Est**: 20min / **Actual**: ~15min

## 変更ファイル
- `app/app/shinen/ThoughtCard.tsx`
  - `MediaPreview` の `imgError` state を実際に `onError` で `true` にセット
  - Image サムネイル読み込み失敗時に `OgpFallbackPreview`（グレースケール代替）を表示
  - YouTube サムネイル読み込み失敗時にも同様のフォールバックを表示

## 変更概要
既存の `imgError` state と `OgpFallbackPreview` コンポーネントが未接続だった問題を修正。
画像の `onError` イベントで `setImgError(true)` を呼び出し、
`imgError === true` の場合にドメイン頭文字のグレースケールプレースホルダーを表示するようにした。

## ビルド結果
exit code: 0（成功）

```
✓ Compiled successfully in 2.3s
✓ Generating static pages using 7 workers (13/13) in 89.9ms
```

## 動作確認
- ビルドが通過し、静的生成も正常
- OGP画像読み込み失敗時にグレースケールのフォールバック表示
- YouTubeサムネイル失敗時も同様のフォールバック
- 既存のembed timeout fallbackには影響なし

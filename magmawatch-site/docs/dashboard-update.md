# Dashboard — dashboard.json データ更新手順

## データファイル

`data/dashboard.json`

## スキーマ

```jsonc
{
  "asOf": "2026.03 W4",        // 表示用の期間ラベル
  "updatedAt": "2026-03-29T15:00:00+09:00",  // ISO 8601
  "rows": [
    {
      "topic": "トピック名",     // string
      "region": "🇷🇺 RU",       // 国旗 + 2文字コード
      "heat": 88,               // 0–100（バー表示）
      "delta7d": 12,            // 7日間の heat 変動（整数）
      "persistence": 0.82,      // 0.0–1.0（%表示）
      "spread": 4,              // 1–5（ドット表示）
      "suppression": 0.75,      // 0.0–1.0（%表示）
      "suppressionDelta7d": 0.15, // 7日間の suppression 変動（小数）
      "signal": "accelerating", // accelerating|spike|emerging|sustained|steady|cooling
      "anomaly": true           // true → 行ハイライト + パルスドット
    }
  ]
}
```

## 更新手順

1. `data/dashboard.json` を編集（上記スキーマに従う）
2. `npm run build` でビルド確認
3. コミット & プッシュ → Vercel が自動デプロイ

## signal 値の意味

| signal | 意味 |
|---|---|
| accelerating | 加速中 |
| spike | 急騰 |
| emerging | 新規浮上 |
| sustained | 持続 |
| steady | 安定 |
| cooling | 鎮静化 |

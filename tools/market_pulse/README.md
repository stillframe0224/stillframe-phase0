# Market Pulse

毎日自動で「痛み/需要」を収集→要約→スコア→候補化→レポート化するパイプライン。

## 概要

RSS/Atomフィード（HN, Product Hunt, Reddit, 個人ブログ等）から公開記事を収集し、
ルールベースでスコアリングして、需要の高いトピックを抽出する。

LLMキー不要（決定論的要約）。完全オフライン動作可能。

## ディレクトリ構成

```
tools/market_pulse/
├── src/
│   ├── cli.ts        # エントリポイント
│   ├── config.ts     # sources.yaml ローダー
│   ├── fetch.ts      # RSS/Atomフェッチ（タイムアウト/リトライ/partial success）
│   ├── normalize.ts  # 重複除去・日付フィルタ
│   ├── summarize.ts  # 決定論的要約（LLMインターフェース付き）
│   ├── score.ts      # ルールベーススコアリング
│   ├── cluster.ts    # 簡易クラスタリング（Jaccard類似度）
│   ├── render.ts     # Markdownレポート生成
│   └── types.ts      # 共通型定義
├── sources.yaml      # ソース定義・キーワード設定
├── tsconfig.json
└── README.md         # このファイル
```

## 出力ファイル

| ファイル | 説明 |
|---------|------|
| `reports/market_pulse/YYYY-MM-DD.md` | 日次レポート（クラスタ・スコア・Warning一覧） |
| `reports/market_pulse/candidates.json` | 上位50件（スコア内訳付き） |
| `reports/market_pulse/raw.jsonl` | 全収集アイテム（最大5000行、デバッグ用） |
| `issues/auto_generated/YYYY-MM-DD/<slug>.md` | Issue草案（上位10件、スコア≥15） |

## 実行方法

### 開発時（tsx使用、ビルド不要）

```bash
npm run market:pulse:dev
# オプション指定
npm run market:pulse:dev -- --date 2025-01-01 --limit 20 --dry-run
```

### ビルド後実行

```bash
npm run market:pulse:build
npm run market:pulse
```

### スモークテスト

```bash
bash scripts/market_pulse_smoke.sh
```

## CLIオプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--date YYYY-MM-DD` | 対象日付 | 当日（JST） |
| `--limit N` | 各ソースの最大収集件数 | 30 |
| `--dry-run` | ファイル書き込みなし（確認用） | false |

## スコアリング

| 項目 | 最大点 | 説明 |
|------|--------|------|
| Pain | 40 | 痛みキーワード（"frustrated", "broken", "wish"など） |
| Demand | 30 | 支払い意図キーワード（"would pay", "looking for"など） |
| Urgency | 20 | 緊急度キーワード（"urgent", "blocking"など） |
| Frequency | 10 | 複数カテゴリにまたがる場合のボーナス |
| SourceWeight | ×N | sources.yamlで定義した重み |

## ソース追加方法

`tools/market_pulse/sources.yaml` に以下を追記：

```yaml
- id: my_source
  name: "My Source Name"
  url: "https://example.com/rss"
  category: blog  # hn / ph / reddit / blog
  tags: [pain, startup]
  weight: 1.0
```

## GitHub Actions

`.github/workflows/market_pulse.yml` で毎日 00:30 UTC（JST 09:30）に自動実行。
差分があれば自動コミット・プッシュ。`workflow_dispatch` で手動実行も可能。

## 将来：LLM要約を使う場合

`summarize.ts` の `LLMSummarizer` インターフェースを実装してください：

```typescript
import { summarize } from "./summarize.js";

const llm: LLMSummarizer = {
  async summarize(text: string): Promise<SummaryBullets> {
    // Claude API等を呼ぶ
  }
};

const result = await summarize(item, llm);
```

LLMが失敗した場合は自動的に決定論的要約にフォールバックします。

## 制約・注意事項

- 認証不要・公開フィードのみ使用（X API等は除外）
- タイムアウト: 10秒/ソース、リトライ: 最大2回
- Partial success: 一部ソースが失敗してもレポートに warning として記録し、全体は継続
- 完全失敗（全ソース失敗）のみ exit code 1
- raw.jsonl は最大5000行で自動ローテーション

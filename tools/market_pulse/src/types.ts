// ============================================================
// Market Pulse — 共通型定義
// ============================================================

/** 正規化済みフィードアイテム */
export interface NormalizedItem {
  id: string;           // sha1(url)
  url: string;
  title: string;
  source: string;       // sources.yaml の id
  sourceName: string;   // sources.yaml の name
  category: string;     // hn / ph / reddit / blog
  publishedAt: string;  // ISO8601
  summaryRaw: string;   // description / content_snippet そのまま
  contentExcerpt: string; // 最大500文字のプレーンテキスト
  tags: string[];
}

/** 要約バレット（決定論的） */
export interface SummaryBullets {
  bullets: string[];    // 最大5行
}

/** スコアリング結果 */
export interface ScoreResult {
  total: number;        // 0-100
  pain: number;         // 0-40
  demand: number;       // 0-30
  urgency: number;      // 0-20
  frequency: number;    // 0-10
  sourceWeight: number; // 掛け算後のboost
  matchedKeywords: string[];
}

/** スコア付きアイテム（候補） */
export interface ScoredItem extends NormalizedItem {
  summary: SummaryBullets;
  score: ScoreResult;
}

/** クラスタ */
export interface Cluster {
  id: string;
  label: string;
  items: ScoredItem[];
  topScore: number;
}

/** フェッチ結果（partial successのため） */
export interface FetchResult {
  sourceId: string;
  items: NormalizedItem[];
  error?: string;
  fetchedAt: string;
}

/** LLM要約インターフェース（将来用。現在は使わない） */
export interface LLMSummarizer {
  summarize(text: string): Promise<SummaryBullets>;
}

/** CLIオプション */
export interface CLIOptions {
  date: string;         // YYYY-MM-DD
  limit: number;        // 各ソースの最大収集件数
  dryRun: boolean;
}

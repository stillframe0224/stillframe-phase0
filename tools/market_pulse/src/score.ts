import { getConfig } from "./config.js";
import type { NormalizedItem, ScoreResult } from "./types.js";

// スコア重み定数（明示的に定義）
const WEIGHTS = {
  pain: 40,      // 痛みキーワード: 最大40点
  demand: 30,    // 支払い意図キーワード: 最大30点
  urgency: 20,   // 緊急度キーワード: 最大20点
  frequency: 10, // キーワードの出現頻度ボーナス: 最大10点
} as const;

function countMatches(text: string, keywords: string[]): { count: number; matched: string[] } {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      matched.push(kw);
    }
  }
  return { count: matched.length, matched };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * ルールベーススコアリング
 * 入力テキスト = title + summaryRaw + contentExcerpt を結合して評価
 */
export function scoreItem(item: NormalizedItem): ScoreResult {
  const config = getConfig();
  const source = config.sources.find((s) => s.id === item.source);
  const sourceWeight = source?.weight ?? 1.0;

  const fullText = [item.title, item.summaryRaw, item.contentExcerpt].join(" ");

  // 痛みスコア
  const painResult = countMatches(fullText, config.pain_keywords);
  const painRaw = clamp(painResult.count * 8, 0, WEIGHTS.pain);

  // 需要スコア
  const demandResult = countMatches(fullText, config.demand_keywords);
  const demandRaw = clamp(demandResult.count * 10, 0, WEIGHTS.demand);

  // 緊急度スコア
  const urgencyResult = countMatches(fullText, config.urgency_keywords);
  const urgencyRaw = clamp(urgencyResult.count * 10, 0, WEIGHTS.urgency);

  // 頻度ボーナス: 複数キーワードカテゴリにまたがるとボーナス
  const categoriesHit = [painResult.count > 0, demandResult.count > 0, urgencyResult.count > 0].filter(Boolean).length;
  const frequencyRaw = clamp(categoriesHit * 4 - 2, 0, WEIGHTS.frequency);

  // 合計（source weightで補正後0-100にclamp）
  const rawTotal = painRaw + demandRaw + urgencyRaw + Math.max(0, frequencyRaw);
  const total = clamp(Math.round(rawTotal * sourceWeight), 0, 100);

  const matchedKeywords = [
    ...painResult.matched,
    ...demandResult.matched,
    ...urgencyResult.matched,
  ];

  return {
    total,
    pain: Math.round(painRaw),
    demand: Math.round(demandRaw),
    urgency: Math.round(urgencyRaw),
    frequency: Math.max(0, Math.round(frequencyRaw)),
    sourceWeight,
    matchedKeywords: [...new Set(matchedKeywords)],
  };
}

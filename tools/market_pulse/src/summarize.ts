import type { SummaryBullets, NormalizedItem, LLMSummarizer } from "./types.js";

const MAX_BULLETS = 5;
const MIN_SENTENCE_LEN = 20;

/**
 * テキストを文に分割
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_SENTENCE_LEN);
}

/**
 * 決定論的要約：
 * 1. summaryRaw → contentExcerpt → title の順で素材を選ぶ
 * 2. 文分割して最初の MAX_BULLETS 文をバレット化
 * 3. 冪等・同入力同出力
 */
export function summarizeDeterministic(item: NormalizedItem): SummaryBullets {
  const text = [item.summaryRaw, item.contentExcerpt, item.title]
    .filter(Boolean)
    .join(" ");

  const sentences = splitSentences(text);

  let bullets: string[];
  if (sentences.length > 0) {
    bullets = sentences.slice(0, MAX_BULLETS).map((s) => {
      // 長すぎる文は80文字で切る
      return s.length > 80 ? s.slice(0, 77) + "..." : s;
    });
  } else {
    // フォールバック: タイトルのみ
    bullets = [item.title.slice(0, 80)];
  }

  return { bullets };
}

/**
 * LLM要約（オプション。llmがあれば使う、なければ決定論的にフォールバック）
 */
export async function summarize(
  item: NormalizedItem,
  llm?: LLMSummarizer
): Promise<SummaryBullets> {
  if (llm) {
    try {
      const text = [item.title, item.summaryRaw, item.contentExcerpt]
        .filter(Boolean)
        .join("\n");
      return await llm.summarize(text);
    } catch {
      // LLMが失敗したら決定論的にフォールバック
    }
  }
  return summarizeDeterministic(item);
}

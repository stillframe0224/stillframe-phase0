import type { ScoredItem, Cluster } from "./types.js";

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "in", "it", "of", "to", "and", "or", "for",
  "with", "on", "at", "by", "as", "be", "was", "are", "this", "that",
  "from", "have", "has", "had", "not", "but", "so", "if", "we", "you",
  "your", "my", "i", "do", "does", "did", "what", "how", "why", "when",
  "which", "who", "can", "will", "would", "could", "should", "than",
  "more", "some", "any", "all", "about", "up", "out", "into", "over",
  "after", "just", "no", "my", "their", "its", "our",
]);

const MIN_TOKEN_LEN = 3;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= MIN_TOKEN_LEN && !STOP_WORDS.has(t))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter((t) => b.has(t)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function makeSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function extractLabel(items: ScoredItem[]): string {
  // スコア上位のアイテムのトークンを集計し、最頻出ワードをラベルに
  const freq = new Map<string, number>();
  for (const item of items.slice(0, 5)) {
    const tokens = tokenize([item.title, item.summaryRaw].join(" "));
    for (const t of tokens) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return sorted
    .slice(0, 3)
    .map(([t]) => t)
    .join(" ");
}

const SIMILARITY_THRESHOLD = 0.15; // Jaccardで0.15以上で同クラスタとみなす

/**
 * 簡易グリーディークラスタリング（O(n^2)だが件数は<200程度なので許容）
 */
export function clusterItems(items: ScoredItem[]): Cluster[] {
  // スコア降順でソート
  const sorted = [...items].sort((a, b) => b.score.total - a.score.total);

  const clusters: { tokens: Set<string>; items: ScoredItem[] }[] = [];

  for (const item of sorted) {
    const tokens = tokenize([item.title, item.summaryRaw, ...item.tags].join(" "));
    let assigned = false;

    for (const cluster of clusters) {
      const sim = jaccardSimilarity(tokens, cluster.tokens);
      if (sim >= SIMILARITY_THRESHOLD) {
        cluster.items.push(item);
        // クラスタのトークンを更新（ユニオン）
        for (const t of tokens) cluster.tokens.add(t);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      clusters.push({ tokens, items: [item] });
    }
  }

  return clusters.map((c, i) => {
    const topScore = Math.max(...c.items.map((it) => it.score.total));
    const label = extractLabel(c.items) || `cluster-${i + 1}`;
    return {
      id: makeSlug(label),
      label,
      items: c.items,
      topScore,
    };
  });
}

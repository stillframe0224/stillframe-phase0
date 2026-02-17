import type { NormalizedItem } from "./types.js";

/**
 * 重複除去（url/id単位）
 */
export function deduplicateItems(items: NormalizedItem[]): NormalizedItem[] {
  const seen = new Set<string>();
  const result: NormalizedItem[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

/**
 * publishedAt の古い順でフィルタ（指定日より古いものを除外）
 */
export function filterByDate(
  items: NormalizedItem[],
  afterDate: Date
): NormalizedItem[] {
  return items.filter((item) => {
    const d = new Date(item.publishedAt);
    return !isNaN(d.getTime()) && d >= afterDate;
  });
}

/**
 * publishedAt 降順ソート
 */
export function sortByDate(items: NormalizedItem[]): NormalizedItem[] {
  return [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

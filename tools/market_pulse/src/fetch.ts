import Parser from "rss-parser";
import crypto from "crypto";
import { getConfig } from "./config.js";
import type { NormalizedItem, FetchResult } from "./types.js";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2_000;

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent": "market-pulse-bot/1.0 (stillframe-phase0; +https://github.com/array0224-cloud/stillframe-phase0)",
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["description", "description"],
      ["dc:creator", "creator"],
    ],
  },
});

function makeId(url: string): string {
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 12);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExcerpt(item: Parser.Item & { contentEncoded?: string }): string {
  // rss-parser の Item 型には description がないため any 経由でアクセス
  const anyItem = item as Record<string, unknown>;
  const raw =
    (anyItem["contentEncoded"] as string | undefined) ||
    item.content ||
    item.contentSnippet ||
    item.summary ||
    (anyItem["description"] as string | undefined) ||
    "";
  return stripHtml(raw).slice(0, 500);
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Parser.Output<Parser.Item>> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await parser.parseURL(url);
    } catch (e) {
      lastErr = e as Error;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  throw lastErr;
}

export async function fetchSource(
  sourceId: string,
  limit: number
): Promise<FetchResult> {
  const config = getConfig();
  const source = config.sources.find((s) => s.id === sourceId);
  if (!source) {
    return {
      sourceId,
      items: [],
      error: `Source "${sourceId}" not found in config`,
      fetchedAt: new Date().toISOString(),
    };
  }

  try {
    const feed = await fetchWithRetry(source.url);
    const rawItems = feed.items.slice(0, limit);

    const items: NormalizedItem[] = rawItems.map((item) => {
      const url = item.link || item.guid || "";
      const anyItem = item as Record<string, unknown>;
      const summaryRaw =
        item.contentSnippet ||
        item.summary ||
        (anyItem["description"] as string | undefined) ||
        "";
      const excerpt = extractExcerpt(item as Parser.Item & { contentEncoded?: string });

      return {
        id: makeId(url),
        url,
        title: item.title || "(no title)",
        source: source.id,
        sourceName: source.name,
        category: source.category,
        publishedAt: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString(),
        summaryRaw: summaryRaw.slice(0, 1000),
        contentExcerpt: excerpt,
        tags: source.tags,
      };
    });

    return {
      sourceId,
      items,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      sourceId,
      items: [],
      error: `Failed to fetch "${source.url}": ${msg}`,
      fetchedAt: new Date().toISOString(),
    };
  }
}

export async function fetchAllSources(limit: number): Promise<FetchResult[]> {
  const config = getConfig();
  // 全ソースを並列取得（partial success: 各ソース独立）
  const results = await Promise.allSettled(
    config.sources.map((s) => fetchSource(s.id, limit))
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      sourceId: config.sources[i].id,
      items: [],
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      fetchedAt: new Date().toISOString(),
    };
  });
}

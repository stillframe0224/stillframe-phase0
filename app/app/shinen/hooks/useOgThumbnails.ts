/**
 * useOgThumbnails — lazy-fetch OG image thumbnails for clip cards.
 *
 * Scans cards for type-8 (clip) entries with source.url but no media.
 * Fetches /api/link-preview?url=<url>, caches results in localStorage,
 * and patches card.media via setCards. YouTube URLs are skipped (they
 * already have media.type === "youtube").
 */

import { useEffect, useRef } from "react";
import type { ShinenCard } from "../lib/types";

const OG_CACHE_KEY = "shinen_og_v1";
const DEFAULT_FAILURE_TTL = 5 * 60 * 1000; // 5 min
const MAX_CACHE_SIZE = 200;

// Domains where OG images are structurally unavailable (login walls, JS-only, etc.)
// The server-side Jina fallback handles Twitter/X and Facebook — still allow them through.
// These are truly unresolvable even via Jina.
const SKIP_OG_HOSTS = new Set([
  "docs.google.com",
  "drive.google.com",
  "mail.google.com",
  "notion.so",
  "www.notion.so",
  "app.notion.so",
]);

function shouldSkipOg(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return SKIP_OG_HOSTS.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

interface OgCacheEntry {
  image: string | null;
  fetchedAt: number;
  retryAfterMs?: number;
}

type OgCache = Record<string, OgCacheEntry>;

function readCache(): OgCache {
  try {
    const raw = localStorage.getItem(OG_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as OgCache;
  } catch {
    // Malformed cache — reset.
  }
  return {};
}

function writeCache(cache: OgCache): void {
  try {
    // Evict oldest entries if over size cap
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_SIZE) {
      const sorted = keys.sort(
        (a, b) => (cache[a].fetchedAt ?? 0) - (cache[b].fetchedAt ?? 0),
      );
      const toRemove = sorted.slice(0, keys.length - MAX_CACHE_SIZE);
      for (const k of toRemove) delete cache[k];
    }
    localStorage.setItem(OG_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or disabled — silently ignore.
  }
}

export function useOgThumbnails(
  cards: ShinenCard[],
  setCards: React.Dispatch<React.SetStateAction<ShinenCard[]>>,
) {
  const inflightRef = useRef<Set<string>>(new Set());

  // Derive a stable dependency key from URLs that need fetching.
  const needsOgKey = cards
    .filter((c) => c.type === 8 && c.source?.url && !c.media)
    .map((c) => c.source!.url)
    .sort()
    .join("|");

  useEffect(() => {
    if (!needsOgKey) return;

    const needsOg = cards.filter(
      (c) => c.type === 8 && c.source?.url && !c.media,
    );
    if (needsOg.length === 0) return;

    const cache = readCache();
    const cacheHits: Array<{ id: number; imageUrl: string }> = [];
    const toFetch: Array<{ id: number; url: string }> = [];

    for (const card of needsOg) {
      const url = card.source!.url;
      // Skip domains where OG fetch is structurally futile
      if (shouldSkipOg(url)) continue;
      const entry = cache[url];
      if (entry) {
        if (entry.image) {
          cacheHits.push({ id: card.id, imageUrl: entry.image });
        } else {
          // Failure entry — check TTL
          const ttl = entry.retryAfterMs ?? DEFAULT_FAILURE_TTL;
          if (Date.now() - entry.fetchedAt < ttl) continue; // still within TTL
          toFetch.push({ id: card.id, url }); // expired, retry
        }
      } else {
        toFetch.push({ id: card.id, url });
      }
    }

    // Apply cache hits in one batch
    if (cacheHits.length > 0) {
      const hitMap = new Map(cacheHits.map((h) => [h.id, h.imageUrl]));
      setCards((prev) =>
        prev.map((c) => {
          const img = hitMap.get(c.id);
          if (!img || c.media) return c;
          return { ...c, media: { type: "image" as const, url: img } };
        }),
      );
    }

    // Fetch cache misses
    if (toFetch.length === 0) return;

    const controller = new AbortController();

    for (const { id, url } of toFetch) {
      if (inflightRef.current.has(url)) continue;
      inflightRef.current.add(url);

      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then(
          (data: { image?: string | null; retryAfterMs?: number }) => {
            inflightRef.current.delete(url);
            const currentCache = readCache();
            if (data.image) {
              currentCache[url] = {
                image: data.image,
                fetchedAt: Date.now(),
              };
              writeCache(currentCache);
              setCards((prev) =>
                prev.map((c) =>
                  c.id === id && !c.media
                    ? {
                        ...c,
                        media: { type: "image" as const, url: data.image! },
                      }
                    : c,
                ),
              );
            } else {
              currentCache[url] = {
                image: null,
                fetchedAt: Date.now(),
                retryAfterMs: data.retryAfterMs,
              };
              writeCache(currentCache);
            }
          },
        )
        .catch(() => {
          inflightRef.current.delete(url);
          const currentCache = readCache();
          currentCache[url] = { image: null, fetchedAt: Date.now() };
          writeCache(currentCache);
        });
    }

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOgKey, setCards]);
}

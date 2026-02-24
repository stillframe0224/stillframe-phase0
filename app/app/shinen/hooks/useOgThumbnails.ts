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
  favicon?: string | null;
  fetchedAt: number;
  retryAfterMs?: number;
}

type OgCache = Record<string, OgCacheEntry>;

/** Domains where we still show OG thumbnails (YouTube handled separately via media.type=youtube). */
function isImageAllowedHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.includes("amazon.") || h.includes("amzn.") || h === "a.co";
  } catch {
    return false;
  }
}

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

  // Derive a stable dependency key from clip cards that need fetching (no media, or missing favicon).
  const needsFetchKey = cards
    .filter((c) => c.type === 8 && c.source?.url && (!c.media || !c.source?.favicon))
    .map((c) => c.source!.url)
    .sort()
    .join("|");

  useEffect(() => {
    if (!needsFetchKey) return;

    const needsFetch = cards.filter(
      (c) => c.type === 8 && c.source?.url && (!c.media || !c.source?.favicon),
    );
    if (needsFetch.length === 0) return;

    const cache = readCache();
    const cacheHits: Array<{ id: number; imageUrl: string | null; favicon: string | null }> = [];
    const toFetch: Array<{ id: number; url: string }> = [];

    for (const card of needsFetch) {
      const url = card.source!.url;
      if (shouldSkipOg(url)) continue;
      const entry = cache[url];
      if (entry) {
        if (entry.image || entry.favicon) {
          cacheHits.push({ id: card.id, imageUrl: entry.image, favicon: entry.favicon ?? null });
        } else {
          const ttl = entry.retryAfterMs ?? DEFAULT_FAILURE_TTL;
          if (Date.now() - entry.fetchedAt < ttl) continue;
          toFetch.push({ id: card.id, url });
        }
      } else {
        toFetch.push({ id: card.id, url });
      }
    }

    // Apply cache hits in one batch
    if (cacheHits.length > 0) {
      const hitMap = new Map(cacheHits.map((h) => [h.id, h]));
      setCards((prev) =>
        prev.map((c) => {
          const hit = hitMap.get(c.id);
          if (!hit) return c;
          const updates: Partial<typeof c> = {};
          // Only set media for Amazon hosts (YouTube already has media)
          if (hit.imageUrl && !c.media && c.source?.url && isImageAllowedHost(c.source.url)) {
            updates.media = { type: "image" as const, url: hit.imageUrl };
          }
          // Always apply favicon
          if (hit.favicon && c.source && !c.source.favicon) {
            updates.source = { ...c.source, favicon: hit.favicon };
          }
          return Object.keys(updates).length > 0 ? { ...c, ...updates } : c;
        }),
      );
    }

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
          (data: { image?: string | null; favicon?: string | null; retryAfterMs?: number }) => {
            inflightRef.current.delete(url);
            const currentCache = readCache();
            currentCache[url] = {
              image: data.image ?? null,
              favicon: data.favicon ?? null,
              fetchedAt: Date.now(),
              ...(data.image ? {} : { retryAfterMs: data.retryAfterMs }),
            };
            writeCache(currentCache);

            const showImage = data.image && isImageAllowedHost(url);
            const favicon = data.favicon ?? null;

            if (showImage || favicon) {
              setCards((prev) =>
                prev.map((c) => {
                  if (c.id !== id) return c;
                  const updates: Partial<typeof c> = {};
                  if (showImage && !c.media) {
                    updates.media = { type: "image" as const, url: data.image! };
                  }
                  if (favicon && c.source && !c.source.favicon) {
                    updates.source = { ...c.source, favicon };
                  }
                  return Object.keys(updates).length > 0 ? { ...c, ...updates } : c;
                }),
              );
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
  }, [needsFetchKey, setCards]);
}

import { NextResponse } from "next/server";
import { validateUrl, dnsCheck } from "@/lib/ssrf";

export const dynamic = "force-dynamic";

const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

const IG_RE =
  /(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT = 4000;

// Browser-like UA for services that filter bots
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function isInstagramHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "instagram.com" ||
    h.endsWith(".instagram.com") ||
    h === "instagr.am" ||
    h.endsWith(".instagr.am")
  );
}

// Normalize scheme-less or mobile Instagram URLs before URL parsing.
// Handles: instagram.com/p/xxx, //instagram.com/p/xxx, m.instagram.com/p/xxx
function normalizeInstagramUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) {
    // Already has scheme — normalize m. → www.
    return raw.replace(/^(https?:\/\/)m\.instagram\.com\//i, "$1www.instagram.com/");
  }
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^(?:(?:www|m)\.)?instagram\.com\//i.test(raw)) {
    return `https://www.instagram.com/${raw.replace(/^(?:(?:www|m)\.)?instagram\.com\//i, "")}`;
  }
  return raw;
}

function parseRetryAfterMs(v: string | null): number | null {
  if (!v) return null;
  const num = Number(v);
  if (Number.isFinite(num) && num > 0) return Math.floor(num * 1000);
  const at = Date.parse(v);
  if (!Number.isNaN(at)) {
    const ms = at - Date.now();
    return ms > 0 ? ms : null;
  }
  return null;
}

function failureRetryAfterMs(status?: number, retryAfterHeader?: string | null): number {
  if (status === 429) {
    // Respect Retry-After but cap at 10 min
    const ra = parseRetryAfterMs(retryAfterHeader ?? null);
    return ra != null ? Math.min(ra, 10 * 60 * 1000) : 5 * 60 * 1000;
  }
  if (status === 403) return 10 * 60 * 1000;
  // Other errors: 5 min (was 5 min — keep short to allow retries)
  return 5 * 60 * 1000;
}

function failureCacheHeader(status?: number, retryAfterHeader?: string | null): string {
  return `public, max-age=${Math.floor(
    failureRetryAfterMs(status, retryAfterHeader) / 1000
  )}`;
}

// --- Redirect-safe fetch with per-hop validation ---

async function safeFetch(
  urlStr: string
): Promise<{ res: Response; finalUrl: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    let currentUrl = urlStr;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const parsed = new URL(currentUrl);
      if (!validateUrl(parsed)) throw new Error("blocked");
      if (!(await dnsCheck(parsed.hostname))) throw new Error("blocked");

      const res = await fetch(currentUrl, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error("bad_redirect");
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      return { res, finalUrl: currentUrl };
    }
    throw new Error("too_many_redirects");
  } finally {
    clearTimeout(timeout);
  }
}

// --- Meta extraction helpers ---

function extractMeta(html: string, property: string): string | null {
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i"
  );
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null;
}

function extractFavicon(html: string, origin: string): string {
  const match =
    html.match(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i
    ) ??
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i
    );
  if (match?.[1]) {
    try {
      return new URL(match[1], origin).href;
    } catch {
      // ignore
    }
  }
  return `${origin}/favicon.ico`;
}

function resolveUrl(src: string | null, origin: string): string | null {
  if (!src) return null;
  try {
    return new URL(src, origin).href;
  } catch {
    return null;
  }
}

function extractJsonLdImage(html: string): string | null {
  // Extract all JSON-LD script blocks
  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = [...html.matchAll(jsonLdPattern)];

  for (const match of matches) {
    try {
      const json = JSON.parse(match[1]);
      // Handle single object or array
      const items = Array.isArray(json) ? json : [json];

      for (const item of items) {
        // Check for image field (Product, Article, etc.)
        if (item.image) {
          if (typeof item.image === "string") return item.image;
          if (item.image.url) return item.image.url;
          if (Array.isArray(item.image) && item.image[0]) {
            return typeof item.image[0] === "string" ? item.image[0] : item.image[0].url;
          }
        }
        // Check for thumbnailUrl
        if (item.thumbnailUrl) {
          return typeof item.thumbnailUrl === "string" ? item.thumbnailUrl : item.thumbnailUrl.url;
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  }
  return null;
}

// --- Instagram: consolidated oEmbed + jina fallback ---
//
// Strategy (in order):
//   1) www.instagram.com/oembed/?omitscript=true  — public posts, no token, fastest
//   2) r.jina.ai HTML mirror                       — markdown/image extraction
//   3) return null image (short TTL so client can retry)
//
// Both requests use browser-like headers to maximise acceptance rate.

async function fetchInstagramPreview(
  canonicalUrl: string
): Promise<{ image: string | null; title: string | null }> {
  // 1) Instagram native oEmbed (omitscript=true: no embed JS loaded, faster response)
  try {
    const oembedUrl = `https://www.instagram.com/oembed/?url=${encodeURIComponent(
      canonicalUrl
    )}&omitscript=true`;
    const oembedRes = await fetch(oembedUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json,text/javascript,*/*;q=0.9",
        "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
        Referer: "https://www.instagram.com/",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (oembedRes.ok) {
      const data = await oembedRes.json() as Record<string, unknown>;
      const thumb = typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
      const title = typeof data.title === "string" ? data.title : null;
      if (thumb) return { image: thumb, title };
    }
  } catch {
    // fall through to jina
  }

  // 2) Jina.ai reader — returns JSON with images array
  try {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(canonicalUrl)}`;
    const jinaRes = await fetch(jinaUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
        "X-Return-Format": "json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (jinaRes.ok) {
      const jinaData = await jinaRes.json() as Record<string, unknown>;
      const data = jinaData?.data as Record<string, unknown> | undefined;
      const images = data?.images as Array<{ src?: string }> | undefined;
      const firstImg = images?.[0]?.src ?? null;
      const title = typeof data?.title === "string" ? data.title : null;
      if (firstImg) return { image: firstImg, title };
    }
  } catch {
    // both failed
  }

  return { image: null, title: null };
}

// --- Route handler ---

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  const debug = searchParams.get("debug") === "1";

  if (!rawUrl) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  // Normalize before parsing — handles scheme-less, m.instagram.com, etc.
  const url = normalizeInstagramUrl(rawUrl);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (!validateUrl(parsed)) {
    if (debug) console.log(JSON.stringify({ event: "link_preview_blocked", url, reason: "validation" }));
    return NextResponse.json({ error: "blocked_url" }, { status: 400 });
  }

  // YouTube shortcut — no HTML fetch needed
  const ytMatch = url.match(YT_RE);
  if (ytMatch) {
    return NextResponse.json(
      {
        image: `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`,
        favicon: "https://www.youtube.com/favicon.ico",
        title: null,
      },
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
  }

  // Instagram — consolidated path (IG_RE match OR isInstagramHost)
  // Handles /p/, /reel/, /tv/ paths from any Instagram hostname variant.
  const igMatch = url.match(IG_RE);
  if (igMatch || isInstagramHost(parsed.hostname)) {
    const { image, title } = await fetchInstagramPreview(url);
    if (image) {
      return NextResponse.json(
        { image, favicon: "https://www.instagram.com/favicon.ico", title },
        { headers: { "Cache-Control": "public, max-age=3600" } }
      );
    }
    // Negative cache: short TTL so the client can retry after a cool-down
    // (403 from IG is transient — don't lock out for 10 min)
    return NextResponse.json(
      { image: null, favicon: "https://www.instagram.com/favicon.ico", title: null },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  }

  try {
    const { res, finalUrl } = await safeFetch(url);

    if (!res.ok) {
      if (debug) console.log(JSON.stringify({ event: "link_preview_upstream", url, status: res.status }));
      const retryAfterMs = failureRetryAfterMs(res.status, res.headers.get("retry-after"));
      return NextResponse.json(
        { image: null, favicon: `${parsed.origin}/favicon.ico`, title: null, retryAfterMs },
        { headers: { "Cache-Control": failureCacheHeader(res.status, res.headers.get("retry-after")) } }
      );
    }

    const finalOrigin = new URL(finalUrl).origin;
    const html = await res.text();

    // Try OGP first, then Twitter Card, then JSON-LD fallback
    const ogImage = extractMeta(html, "og:image");
    const twImage = extractMeta(html, "twitter:image");
    const jsonLdImage = extractJsonLdImage(html);

    const image = resolveUrl(ogImage ?? twImage ?? jsonLdImage, finalOrigin);
    const title = extractMeta(html, "og:title");
    const favicon = extractFavicon(html, finalOrigin);

    return NextResponse.json(
      { image, favicon, title },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    if (debug) console.log(JSON.stringify({ event: "link_preview_error", url, reason }));
    if (reason === "blocked") {
      return NextResponse.json({ error: "blocked_url" }, { status: 400 });
    }
    return NextResponse.json(
      { image: null, favicon: `${parsed.origin}/favicon.ico`, title: null, retryAfterMs: 5 * 60 * 1000 },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  }
}

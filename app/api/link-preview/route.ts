import { NextResponse } from "next/server";
import { validateUrl, dnsCheck } from "@/lib/ssrf";
import { extractMeta, isAmazonHost, pickBestImageFromHtml } from "./imageExtract.mjs";
import {
  chooseCoverByProbe,
  extractCid,
  isAgeGateHtml,
  isDmmLikeHost,
  isLikelySharedDmmImage,
} from "./fanzaThumb.mjs";
import {
  buildEmbedMedia,
  collectImageCandidatesFromHtml,
  detectVideoFromHtml,
  isInstagramHost,
  isLoginWallHtml,
  isXHost,
  selectBestImageCandidate,
} from "./xigMedia.mjs";

export const dynamic = "force-dynamic";

const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

const IG_RE =
  /(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT = 6000; // 4s→6s for slow sites (Substack etc.)
const JINA_TIMEOUT = 7000;  // Jina needs a bit more headroom

// Default Chrome-like UA — most sites allow Googlebot/Chrome; bot UAs are widely blocked.
const UA_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const ACCEPT_HTML =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

// Domains where direct HTTP fetch is always blocked/useless — skip safeFetch,
// go straight to Jina fallback.
const JINA_FIRST_HOSTS = new Set([
  "twitter.com",
  "x.com",
  "t.co",
  "facebook.com",
  "www.facebook.com",
  "fb.com",
  "fb.me",
  "linkedin.com",
  "www.linkedin.com",
  "tiktok.com",
  "www.tiktok.com",
]);

function isJinaFirstHost(host: string): boolean {
  return JINA_FIRST_HOSTS.has(host.toLowerCase());
}

function buildAmazonPageHeaders(currentUrl: string): HeadersInit {
  let referer = "https://www.amazon.co.jp/";
  try {
    const parsed = new URL(currentUrl);
    if (isAmazonHost(parsed.hostname)) {
      referer = `${parsed.origin}/`;
    }
  } catch {
    // Fallback referer remains amazon.co.jp
  }
  return {
    "User-Agent": UA_CHROME,
    Accept: ACCEPT_HTML,
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    Referer: referer,
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
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
    return parseRetryAfterMs(retryAfterHeader ?? null) ?? 5 * 60 * 1000;
  }
  if (status === 403) return 10 * 60 * 1000;
  return 5 * 60 * 1000;
}

function failureCacheHeader(status?: number, retryAfterHeader?: string | null): string {
  return `public, max-age=${Math.floor(
    failureRetryAfterMs(status, retryAfterHeader) / 1000
  )}`;
}

// --- Jina.ai universal fallback ---
// Returns { image, title } or null on failure.
async function fetchViaJina(
  url: string,
  origin: string,
): Promise<{ image: string | null; title: string | null } | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const res = await fetch(jinaUrl, {
      headers: {
        "User-Agent": UA_CHROME,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en;q=0.8",
      },
      signal: AbortSignal.timeout(JINA_TIMEOUT),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const ogImage = extractMeta(html, "og:image");
    const twImage = extractMeta(html, "twitter:image");
    const image = resolveUrl(ogImage ?? twImage, origin);
    const title = extractMeta(html, "og:title");
    return { image, title };
  } catch {
    return null;
  }
}

async function fetchViaJinaHtml(url: string): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const res = await fetch(jinaUrl, {
      headers: {
        "User-Agent": UA_CHROME,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(JINA_TIMEOUT),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
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

      // Amazon needs full browser headers to avoid 403/503
      const amazon = isAmazonHost(parsed.hostname);
      const res = await fetch(currentUrl, {
        headers: amazon
          ? buildAmazonPageHeaders(currentUrl)
          : {
              "User-Agent": UA_CHROME,
              Accept: ACCEPT_HTML,
              "Accept-Language": "ja,en;q=0.8",
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

// --- Route handler ---

// Normalize scheme-less or malformed Instagram URLs before URL parsing.
// e.g. "instagram.com/p/xxx" → "https://www.instagram.com/p/xxx"
function normalizeInstagramUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^(?:www\.)?instagram\.com\//i.test(raw)) {
    return `https://www.${raw.replace(/^www\./i, "")}`;
  }
  return raw;
}

// YouTube: maxresdefault may return a 404-placeholder (120×90).
// Probe with HEAD; fall back to hqdefault (guaranteed 480×360).
async function resolveYoutubeThumbnail(videoId: string): Promise<string> {
  const maxres = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const hq = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  try {
    const res = await fetch(maxres, {
      method: "HEAD",
      signal: AbortSignal.timeout(2000),
    });
    // maxresdefault returns 200 for real thumbnails, 404 for unavailable ones.
    // ytimg always returns 200 even for placeholders — check content-length.
    // Placeholder is ~1 KB; real thumbnails are >10 KB.
    const len = Number(res.headers.get("content-length") ?? "0");
    if (res.ok && len > 5000) return maxres;
  } catch {
    // HEAD failed — fall through to hqdefault
  }
  return hq;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  const debug = searchParams.get("debug") === "1";

  if (!rawUrl) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  // Normalize before parsing (handles scheme-less Instagram URLs)
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
    const image = await resolveYoutubeThumbnail(ytMatch[1]);
    return NextResponse.json(
      { image, favicon: "https://www.youtube.com/favicon.ico", title: null },
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
  }

  // Instagram shortcut — OG image primary (via Jina), oEmbed fallback
  // OG images are full-resolution; oEmbed thumbnails are typically 150-320px
  const igMatch = url.match(IG_RE);
  if (igMatch || isXHost(parsed.hostname)) {
    const provider = isXHost(parsed.hostname) ? "x" : "instagram";
    const html = await fetchViaJinaHtml(url);
    const loginWall = html ? isLoginWallHtml(url, html) : false;
    const isVideo = detectVideoFromHtml(url, html ?? "") || (provider === "instagram" && igMatch && /\/(reel|tv)\//i.test(url));
    const xigBestImage = !html || loginWall
      ? null
      : selectBestImageCandidate(collectImageCandidatesFromHtml(html, parsed.origin));
    if (isVideo) {
      const embed = buildEmbedMedia(url, html ?? "", xigBestImage);
      if (embed) {
        return NextResponse.json(
          {
            image: embed.posterUrl,
            posterUrl: embed.posterUrl,
            mediaKind: "embed",
            embedUrl: embed.embedUrl,
            provider: embed.provider,
            favicon: provider === "x" ? "https://x.com/favicon.ico" : "https://www.instagram.com/favicon.ico",
            title: null,
          },
          { headers: { "Cache-Control": "public, max-age=3600" } },
        );
      }
    }
    if (xigBestImage) {
      return NextResponse.json(
        {
          image: xigBestImage,
          posterUrl: xigBestImage,
          mediaKind: "image",
          provider,
          favicon: provider === "x" ? "https://x.com/favicon.ico" : "https://www.instagram.com/favicon.ico",
          title: null,
        },
        { headers: { "Cache-Control": "public, max-age=3600" } },
      );
    }
    if (provider === "x") {
      const embed = buildEmbedMedia(url, html ?? "", null);
      if (embed) {
        return NextResponse.json(
          {
            image: null,
            posterUrl: null,
            mediaKind: "embed",
            embedUrl: embed.embedUrl,
            provider: embed.provider,
            favicon: "https://x.com/favicon.ico",
            title: null,
          },
          { headers: { "Cache-Control": "public, max-age=600" } },
        );
      }
    }

    let jinaImage: string | null = null;
    let jinaTitle: string | null = null;
    let oembedImage: string | null = null;
    let oembedTitle: string | null = null;
    const MAX_REMOTE_FETCH = 6;
    const MIN_GOOD_BYTES = 10 * 1024;
    let remoteFetchCount = 0;

    const guardedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (remoteFetchCount >= MAX_REMOTE_FETCH) return null;
      remoteFetchCount += 1;
      try {
        return await fetch(input, init);
      } catch {
        return null;
      }
    };

    // 1) Jina.ai JSON → extract og:image or first image (full resolution)
    try {
      const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
      const jinaRes = await guardedFetch(jinaUrl, {
        headers: {
          "User-Agent": UA_CHROME,
          Accept: "application/json",
          "X-Return-Format": "json",
        },
        signal: AbortSignal.timeout(JINA_TIMEOUT),
      });
      if (jinaRes?.ok) {
        const jinaData = await jinaRes.json();
        jinaImage = jinaData?.data?.images?.[0]?.src ?? null;
        jinaTitle = jinaData?.data?.title ?? null;
      }
    } catch {
      // jina failed → try oembed
    }

    // 2) oEmbed → thumbnail_url
    try {
      const oembedUrl = `https://www.instagram.com/oembed/?url=${encodeURIComponent(url)}&omitscript=true`;
      const oembedRes = await guardedFetch(oembedUrl, {
        headers: {
          "User-Agent": UA_CHROME,
          "Accept-Language": "ja,en;q=0.8",
        },
        signal: AbortSignal.timeout(3000),
      });
      if (oembedRes?.ok) {
        const data = await oembedRes.json();
        oembedImage = data?.thumbnail_url ?? null;
        oembedTitle = data?.title ?? null;
      }
    } catch {
      // oembed also failed
    }

    // 3) HEAD Content-Length heuristic: pick the larger image
    // HEAD 405/403/timeout → ignore (don't reject), prefer Jina as default
    // Missing Content-Length (e.g. chunked) → don't penalize, keep default
    let bestImage = jinaImage ?? oembedImage;
    let bestTitle = jinaImage ? jinaTitle : oembedTitle;

    if (jinaImage && oembedImage && jinaImage !== oembedImage) {
      try {
        const headMeta = async (targetUrl: string) => {
          const res = await guardedFetch(targetUrl, {
            method: "HEAD",
            signal: AbortSignal.timeout(2000),
          });
          if (!res || res.status === 403 || res.status === 405 || !res.ok) {
            return { kind: "unknown" as const, size: 0 };
          }
          const raw = res.headers.get("content-length");
          const size = Number(raw ?? "");
          if (!Number.isFinite(size) || size <= 0) {
            return { kind: "unknown" as const, size: 0 };
          }
          if (size <= MIN_GOOD_BYTES) {
            return { kind: "tiny" as const, size };
          }
          return { kind: "valid" as const, size };
        };

        const [jinaMeta, oembedMeta] = await Promise.all([
          headMeta(jinaImage),
          headMeta(oembedImage),
        ]);

        // Keep OG(primary) as default; only switch when oEmbed is clearly better.
        if (jinaMeta.kind === "tiny" && oembedMeta.kind === "valid") {
          bestImage = oembedImage;
          bestTitle = oembedTitle;
        } else if (
          jinaMeta.kind === "valid" &&
          oembedMeta.kind === "valid" &&
          oembedMeta.size > jinaMeta.size
        ) {
          bestImage = oembedImage;
          bestTitle = oembedTitle;
        }
      } catch {
        // HEAD failed → keep jina as default
      }
    }

    if (bestImage) {
      return NextResponse.json(
        {
          image: bestImage,
          favicon: "https://www.instagram.com/favicon.ico",
          title: bestTitle ?? null,
        },
        { headers: { "Cache-Control": "public, max-age=3600" } }
      );
    }

    return NextResponse.json(
      { image: null, favicon: "https://www.instagram.com/favicon.ico", title: null },
      { headers: { "Cache-Control": "public, max-age=600" } }
    );
  }

  try {
    if (isInstagramHost(parsed.hostname)) {
      // 1) Instagram oEmbed
      try {
        const oembedUrl = `https://www.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
        const oembedRes = await fetch(oembedUrl, {
          headers: {
            "User-Agent": UA_CHROME,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (oembedRes.ok) {
          const data = await oembedRes.json();
          const image = resolveUrl(data?.thumbnail_url ?? null, parsed.origin);
          if (image) {
            return NextResponse.json(
              { image, favicon: "https://www.instagram.com/favicon.ico", title: data?.title ?? null },
              { headers: { "Cache-Control": "public, max-age=3600" } }
            );
          }
        }
      } catch {
        // Fallback to next strategy
      }

      // 2) r.jina.ai HTML mirror
      try {
        const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`;
        const jinaRes = await fetch(jinaUrl, {
          headers: {
            "User-Agent": UA_CHROME,
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(JINA_TIMEOUT),
        });
        if (jinaRes.ok) {
          const jinaHtml = await jinaRes.text();
          const ogImage = extractMeta(jinaHtml, "og:image");
          const twImage = extractMeta(jinaHtml, "twitter:image");
          const image = resolveUrl(ogImage ?? twImage, parsed.origin);
          if (image) {
            return NextResponse.json(
              { image, favicon: "https://www.instagram.com/favicon.ico", title: extractMeta(jinaHtml, "og:title") },
              { headers: { "Cache-Control": "public, max-age=3600" } }
            );
          }
        }
      } catch {
        // Fallback to direct HTML strategy
      }
    }

    // For domains that always block direct scraping, skip safeFetch and go straight to Jina.
    if (isJinaFirstHost(parsed.hostname)) {
      if (debug) console.log(JSON.stringify({ event: "link_preview_jina_first", url }));
      const jina = await fetchViaJina(url, parsed.origin);
      if (jina?.image) {
        return NextResponse.json(
          { image: jina.image, favicon: `${parsed.origin}/favicon.ico`, title: jina.title },
          { headers: { "Cache-Control": "public, max-age=3600" } }
        );
      }
      // Jina also failed for this domain — return null with a longer TTL to avoid hammering
      return NextResponse.json(
        { image: null, favicon: `${parsed.origin}/favicon.ico`, title: null, retryAfterMs: 30 * 60 * 1000 },
        { headers: { "Cache-Control": "public, max-age=1800" } }
      );
    }

    const { res, finalUrl } = await safeFetch(url);

    if (!res.ok) {
      if (debug) console.log(JSON.stringify({ event: "link_preview_upstream", url, status: res.status }));

      if (isDmmLikeHost(parsed.hostname)) {
        const cid = extractCid(url);
        if (cid) {
          const inferred = await chooseCoverByProbe(cid);
          if (inferred) {
            if (debug) console.log(JSON.stringify({ event: "link_preview_fanza_cid_cover", url, cid, inferred }));
            return NextResponse.json(
              { image: inferred, favicon: `${parsed.origin}/favicon.ico`, title: null },
              { headers: { "Cache-Control": "public, max-age=3600" } }
            );
          }
        }
      }

      // Non-2xx from safeFetch — try Jina as fallback before giving up
      const jina = await fetchViaJina(url, parsed.origin);
      if (jina?.image) {
        return NextResponse.json(
          { image: jina.image, favicon: `${parsed.origin}/favicon.ico`, title: jina.title },
          { headers: { "Cache-Control": "public, max-age=3600" } }
        );
      }

      const retryAfterMs = failureRetryAfterMs(res.status, res.headers.get("retry-after"));
      return NextResponse.json(
        { image: null, favicon: `${parsed.origin}/favicon.ico`, title: null, retryAfterMs },
        { headers: { "Cache-Control": failureCacheHeader(res.status, res.headers.get("retry-after")) } }
      );
    }

    const finalParsed = new URL(finalUrl);
    const finalOrigin = finalParsed.origin;
    const html = await res.text();

    const dmmLike = isDmmLikeHost(parsed.hostname) || isDmmLikeHost(finalParsed.hostname);
    let image = pickBestImageFromHtml(html, finalOrigin, finalParsed.hostname);
    let dmmAgeGate = false;
    let dmmSharedImage = false;

    if (dmmLike) {
      dmmAgeGate = isAgeGateHtml(html, finalUrl);
      dmmSharedImage = isLikelySharedDmmImage(image);
      if (dmmAgeGate || dmmSharedImage || !image) {
        const cid = extractCid(url) ?? extractCid(finalUrl);
        if (cid) {
          const inferred = await chooseCoverByProbe(cid);
          if (inferred) {
            image = inferred;
            if (debug) {
              console.log(
                JSON.stringify({
                  event: "link_preview_fanza_cover_inferred",
                  url,
                  finalUrl,
                  cid,
                  ageGate: dmmAgeGate,
                  sharedMetaImage: dmmSharedImage,
                  inferred,
                }),
              );
            }
          } else if (dmmAgeGate || dmmSharedImage) {
            image = null;
          }
        } else if (dmmAgeGate || dmmSharedImage) {
          image = null;
        }
      }
    }

    const title = extractMeta(html, "og:title");
    const favicon = extractFavicon(html, finalOrigin);

    // If direct HTML returned no OG image (e.g. JS-rendered SPA), try Jina as fallback
    if (!image) {
      if (dmmLike && (dmmAgeGate || dmmSharedImage)) {
        return NextResponse.json(
          { image: null, favicon, title },
          { headers: { "Cache-Control": "public, max-age=3600" } }
        );
      }
      if (debug) console.log(JSON.stringify({ event: "link_preview_no_og_try_jina", url }));
      const jina = await fetchViaJina(url, finalOrigin);
      if (jina?.image) {
        return NextResponse.json(
          { image: jina.image, favicon, title: title ?? jina.title },
          { headers: { "Cache-Control": "public, max-age=3600" } }
        );
      }
    }

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

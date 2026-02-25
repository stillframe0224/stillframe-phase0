import { upgradeInstagramUrl } from "../../../api/link-preview/instagramImage.mjs";

const TRACKING_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
]);

function toAbsoluteUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;
  const source = String(rawUrl).trim().replace(/&amp;/gi, "&");
  if (!source) return null;
  try {
    if (baseUrl) return new URL(source, baseUrl).toString();
    return new URL(source).toString();
  } catch {
    return null;
  }
}

function getArea(node) {
  if (!node || typeof node !== "object") return 0;
  const w = Number(
    node.naturalWidth ??
      node.videoWidth ??
      node.width ??
      node.clientWidth ??
      node.offsetWidth ??
      0,
  );
  const h = Number(
    node.naturalHeight ??
      node.videoHeight ??
      node.height ??
      node.clientHeight ??
      node.offsetHeight ??
      0,
  );
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 0;
  return w * h;
}

function isLikelyUiAssetUrl(url) {
  const low = String(url || "").toLowerCase();
  if (!low) return true;
  if (low.startsWith("data:")) return true;
  if (/\.svg(?:\?|$)/i.test(low)) return true;
  return /(favicon|sprite|emoji|icon|avatar|profile)/i.test(low);
}

function parseSrcsetEntries(srcset, baseUrl) {
  if (!srcset || typeof srcset !== "string") return [];
  const out = [];
  for (const rawEntry of srcset.split(",")) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const parts = entry.split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    const abs = toAbsoluteUrl(parts[0], baseUrl);
    if (!abs) continue;
    let score = 1;
    const descriptor = parts[parts.length - 1] || "";
    if (/^\d+w$/i.test(descriptor)) score = Number(descriptor.slice(0, -1)) || 1;
    else if (/^\d+(\.\d+)?x$/i.test(descriptor)) score = Math.round((Number(descriptor.slice(0, -1)) || 1) * 1000);
    out.push({ url: abs, score });
  }
  return out;
}

function readImages(document) {
  if (!document || typeof document !== "object") return [];
  const images = [];
  if (Array.isArray(document.images)) images.push(...document.images);
  if (typeof document.querySelectorAll === "function") {
    try {
      images.push(...document.querySelectorAll("img"));
    } catch {
      // Ignore selector failures in non-DOM test doubles.
    }
  }
  return images;
}

export function normalizeCaptureUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function upgradeXMediaUrlToOrig(rawUrl, baseUrl) {
  const abs = toAbsoluteUrl(rawUrl, baseUrl);
  if (!abs) return null;
  try {
    const parsed = new URL(abs);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("twimg.com")) return parsed.toString();

    parsed.pathname = parsed.pathname.replace(/:(small|medium|large|orig)$/i, ":orig");

    const name = (parsed.searchParams.get("name") || "").toLowerCase();
    if (!name || name === "small" || name === "medium" || name === "large" || name === "thumb") {
      parsed.searchParams.set("name", "orig");
    }

    return parsed.toString();
  } catch {
    return abs;
  }
}

export function pickLargestSrcsetUrlFromDocument(document, baseUrl) {
  if (!document || typeof document.querySelectorAll !== "function") return null;
  let best = null;
  let bestScore = 0;
  for (const image of document.querySelectorAll("img[srcset]")) {
    const srcset = image?.getAttribute?.("srcset") || image?.srcset || "";
    const candidates = parseSrcsetEntries(srcset, baseUrl);
    for (const candidate of candidates) {
      if (isLikelyUiAssetUrl(candidate.url)) continue;
      if (candidate.score > bestScore) {
        bestScore = candidate.score;
        best = candidate.url;
      }
    }
  }
  return best;
}

export function pickLargestNaturalImageUrl(document, baseUrl, filterFn = null) {
  let best = null;
  let bestArea = 0;
  for (const image of readImages(document)) {
    const raw = image?.currentSrc || image?.src || image?.getAttribute?.("src") || "";
    const abs = toAbsoluteUrl(raw, baseUrl);
    if (!abs || isLikelyUiAssetUrl(abs)) continue;
    if (typeof filterFn === "function" && !filterFn(abs, image)) continue;
    const area = getArea(image);
    if (area >= bestArea) {
      best = abs;
      bestArea = area;
    }
  }
  return best;
}

function extractXStatusParts(pageUrl) {
  try {
    const parsed = new URL(pageUrl);
    const match = parsed.pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)/i);
    if (!match) return null;
    return { user: match[1], id: match[2] };
  } catch {
    return null;
  }
}

export function makeXEmbedUrl(pageUrl) {
  const parts = extractXStatusParts(pageUrl);
  if (!parts) return null;
  const statusUrl = `https://x.com/${parts.user}/status/${parts.id}`;
  return `https://platform.twitter.com/embed/Tweet.html?dnt=1&url=${encodeURIComponent(statusUrl)}`;
}

export function makeInstagramEmbedUrl(pageUrl) {
  try {
    const parsed = new URL(pageUrl);
    const host = parsed.hostname.toLowerCase();
    if (
      host !== "instagram.com" &&
      host !== "instagr.am" &&
      !host.endsWith(".instagram.com")
    ) {
      return null;
    }
    const match = parsed.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i);
    if (!match) return null;
    return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/embed/`;
  } catch {
    return null;
  }
}

export function extractXMediaFromDocument(document, pageUrl) {
  const canonicalUrl = normalizeCaptureUrl(pageUrl || document?.location?.href || "");
  const embedUrl = makeXEmbedUrl(canonicalUrl);
  if (!embedUrl) return null;

  let bestPoster = null;
  let bestPosterArea = 0;
  if (document && typeof document.querySelectorAll === "function") {
    for (const video of document.querySelectorAll("video")) {
      const rawPoster = video?.poster || video?.getAttribute?.("poster") || "";
      const poster = upgradeXMediaUrlToOrig(rawPoster, canonicalUrl);
      if (!poster) continue;
      const area = getArea(video);
      if (!bestPoster || area > bestPosterArea) {
        bestPoster = poster;
        bestPosterArea = area;
      }
    }
  }

  const bestImage = pickLargestNaturalImageUrl(
    document,
    canonicalUrl,
    (src) => {
      try {
        const parsed = new URL(src);
        return parsed.hostname.toLowerCase().includes("pbs.twimg.com") && /\/media\//i.test(parsed.pathname);
      } catch {
        return false;
      }
    },
  );
  const bestImageOrig = upgradeXMediaUrlToOrig(bestImage, canonicalUrl);

  if (bestPoster) {
    return {
      kind: "embed",
      provider: "x",
      embedUrl,
      posterUrl: bestPoster,
      imageUrl: bestImageOrig || null,
    };
  }
  if (bestImageOrig) {
    return {
      kind: "image",
      provider: "x",
      embedUrl,
      url: bestImageOrig,
      posterUrl: bestImageOrig,
    };
  }
  return {
    kind: "embed",
    provider: "x",
    embedUrl,
    posterUrl: null,
  };
}

export function extractInstagramMediaFromDocument(document, pageUrl) {
  const canonicalUrl = normalizeCaptureUrl(pageUrl || document?.location?.href || "");
  let parsed;
  try {
    parsed = new URL(canonicalUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host !== "instagram.com" &&
    host !== "instagr.am" &&
    !host.endsWith(".instagram.com")
  ) {
    return null;
  }

  const embedUrl = makeInstagramEmbedUrl(canonicalUrl);
  const srcsetBest = pickLargestSrcsetUrlFromDocument(document, canonicalUrl);
  const naturalBest = pickLargestNaturalImageUrl(document, canonicalUrl);
  const posterUrl = upgradeInstagramUrl(srcsetBest || naturalBest || "");
  const isReel = /\/(reel|tv)\//i.test(parsed.pathname);

  if (isReel && embedUrl) {
    return {
      kind: "embed",
      provider: "instagram",
      embedUrl,
      posterUrl: posterUrl || null,
    };
  }
  if (posterUrl) {
    return {
      kind: "image",
      provider: "instagram",
      url: posterUrl,
      posterUrl,
    };
  }
  return null;
}

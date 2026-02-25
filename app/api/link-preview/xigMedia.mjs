function normalize(input) {
  return String(input || "").trim();
}

function getHost(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function decodeHtmlEntities(input) {
  return String(input || "").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"");
}

export function isXHost(rawUrlOrHost) {
  const host = normalize(rawUrlOrHost).includes("://")
    ? getHost(rawUrlOrHost)
    : normalize(rawUrlOrHost).toLowerCase();
  return host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com");
}

export function isInstagramHost(rawUrlOrHost) {
  const host = normalize(rawUrlOrHost).includes("://")
    ? getHost(rawUrlOrHost)
    : normalize(rawUrlOrHost).toLowerCase();
  return host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am";
}

function extractAttr(tag, name) {
  const quoted = tag.match(new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"))?.[2];
  if (quoted) return quoted;
  return tag.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i"))?.[1] ?? null;
}

function normalizeUrl(src, baseUrl) {
  if (!src) return null;
  const raw = decodeHtmlEntities(String(src)).trim().replace(/^['"]|['"]$/g, "");
  if (!raw) return null;
  try {
    const normalized = raw.startsWith("//") ? `https:${raw}` : raw;
    const url = new URL(normalized, baseUrl);
    if (!/^https?:$/i.test(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function parseImageSizeHints(url) {
  const low = String(url || "").toLowerCase();
  if (/(?:^|[\/_.-])(?:s|p)?(32|48|64|72|96|120|150|180|200)x\1(?:[\/_.-]|$)/.test(low)) return "small";
  if (/1x1|avatar|profile_images|emoji|icon|logo|sprite|favicon|apple-touch-icon|\/svg\//.test(low)) return "icon";
  return "normal";
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function normalizeXMediaUrl(rawUrl) {
  const parsedRaw = normalizeUrl(rawUrl, "https://x.com/");
  if (!parsedRaw) return null;
  try {
    const parsed = new URL(parsedRaw);
    const host = parsed.hostname.toLowerCase();
    if (host === "pbs.twimg.com" || host.endsWith(".pbs.twimg.com")) {
      parsed.pathname = parsed.pathname.replace(/:(small|medium|orig|large)$/i, ":large");
      const currentName = (parsed.searchParams.get("name") || "").toLowerCase();
      if (!currentName || currentName === "small" || currentName === "medium" || currentName === "thumb") {
        parsed.searchParams.set("name", "large");
      }
    }
    return parsed.toString();
  } catch {
    return parsedRaw;
  }
}

export function collectImageCandidatesFromHtml(html, baseUrl) {
  const out = [];
  const seen = new Set();
  const add = (url, source) => {
    const normalized = normalizeUrl(url, baseUrl);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push({ url: normalized, source });
  };

  const metaRe = /<meta\b[^>]*>/gi;
  for (const tag of html.match(metaRe) ?? []) {
    const prop = (extractAttr(tag, "property") || extractAttr(tag, "name") || "").toLowerCase();
    if (!prop) continue;
    if (prop === "og:image" || prop === "twitter:image" || prop === "og:image:secure_url" || prop === "og:image:url") {
      add(extractAttr(tag, "content"), `meta:${prop}`);
    }
  }

  const linkRe = /<link\b[^>]*>/gi;
  for (const tag of html.match(linkRe) ?? []) {
    const rel = (extractAttr(tag, "rel") || "").toLowerCase();
    if (rel.includes("image_src") || rel.includes("icon")) {
      add(extractAttr(tag, "href"), `link:${rel}`);
    }
  }

  const imgRe = /<img\b[^>]*>/gi;
  for (const tag of html.match(imgRe) ?? []) {
    add(extractAttr(tag, "src") || extractAttr(tag, "data-src"), "img");
  }

  return out;
}

export function scoreImage(url) {
  const low = String(url || "").toLowerCase();
  let score = 0;

  if (low.includes("pbs.twimg.com/media/")) score += 10;
  if (low.includes("cdninstagram.com") || low.includes("scontent")) score += 10;
  if (low.includes("/ext_tw_video_thumb/")) score += 6;
  if (low.includes("/ext_tw_video/")) score += 5;

  const sizeHint = parseImageSizeHints(low);
  if (sizeHint === "icon") score -= 50;
  else if (sizeHint === "small") score -= 20;

  return score;
}

export function selectBestImageCandidate(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  let best = null;
  for (const candidate of candidates) {
    if (!candidate?.url) continue;
    const score = scoreImage(candidate.url);
    if (!best || score > best.score) best = { ...candidate, score };
  }
  if (!best) return null;
  return best.score > 0 ? best.url : null;
}

export function isLoginWallHtml(url, html) {
  const host = getHost(url);
  const text = String(html || "");
  if (isXHost(host)) {
    return /Log in to X|Sign in to X|To continue, log in|Log in to Twitter|Sign in|See what's happening|Join X today/i.test(text);
  }
  if (isInstagramHost(host)) {
    return /Log in|Sign up to see photos|See Instagram photos and videos|login/i.test(text);
  }
  return false;
}

function extractMetaValue(html, property) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i");
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null;
}

export function extractTweetId(inputUrl) {
  try {
    const u = new URL(inputUrl);
    const match = u.pathname.match(/^\/[^/]+\/status(?:es)?\/(\d+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function extractXStatusUrl(inputUrl) {
  try {
    const u = new URL(inputUrl);
    const match = u.pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)/i);
    if (!match) return null;
    return `${u.origin}/${match[1]}/status/${match[2]}`;
  } catch {
    return null;
  }
}

function extractInstagramPathParts(inputUrl) {
  try {
    const u = new URL(inputUrl);
    const match = u.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i);
    if (!match) return null;
    return { kind: match[1].toLowerCase(), code: match[2] };
  } catch {
    return null;
  }
}

export function makeInstagramEmbedUrl(inputUrl) {
  const parts = extractInstagramPathParts(inputUrl);
  if (!parts) return null;
  return `https://www.instagram.com/${parts.kind}/${parts.code}/embed/`;
}

export function parseLargestSrcsetImage(html, baseUrl) {
  const srcsetRe = /\bsrcset\s*=\s*(["'])([\s\S]*?)\1/gi;
  let best = null;
  for (const match of html.matchAll(srcsetRe)) {
    const entries = decodeHtmlEntities(match[2])
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const entry of entries) {
      const parts = entry.split(/\s+/).filter(Boolean);
      if (parts.length === 0) continue;
      const url = normalizeUrl(parts[0], baseUrl);
      if (!url) continue;
      const descriptor = parts[parts.length - 1];
      const width = descriptor?.endsWith("w") ? Number(descriptor.slice(0, -1)) : 0;
      const score = Number.isFinite(width) && width > 0 ? width : 1;
      if (!best || score > best.score) best = { url, score };
    }
  }
  if (best?.url) return best.url;
  const fallbackMeta = extractMetaValue(html, "og:image") ?? extractMetaValue(html, "twitter:image");
  return normalizeUrl(fallbackMeta, baseUrl);
}

function collectMediaNodes(payload) {
  const arrays = [
    payload?.mediaDetails,
    payload?.media_details,
    payload?.media,
    payload?.entities?.media,
    payload?.extended_entities?.media,
    payload?.photos,
  ];
  const out = [];
  for (const list of arrays) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && typeof item === "object") out.push(item);
    }
  }
  return out;
}

export function parseSyndicationTweetMedia(payload) {
  if (!payload || typeof payload !== "object") return null;
  const nodes = collectMediaNodes(payload);
  if (nodes.length === 0) return null;

  let photoUrl = null;
  let videoPoster = null;
  let hasVideo = false;

  for (const node of nodes) {
    const type = String(node.type ?? node.media_type ?? node.kind ?? "").toLowerCase();
    const normalizedPhoto = normalizeXMediaUrl(
      firstString(
        node.media_url_https,
        node.media_url,
        node.image?.url,
        node.url,
      ),
    );
    const normalizedPoster = normalizeXMediaUrl(
      firstString(
        node.thumbnail_url,
        node.preview_image_url,
        node.poster_image_url,
        node.media_url_https,
        node.media_url,
        node.image?.url,
      ),
    );

    const videoLike = type === "video" || type === "animated_gif" || Boolean(node.video_info || node.video);
    if (videoLike) {
      hasVideo = true;
      if (!videoPoster && normalizedPoster) videoPoster = normalizedPoster;
      continue;
    }
    if (type === "photo" && normalizedPhoto && !photoUrl) {
      photoUrl = normalizedPhoto;
    }
  }

  if (hasVideo) return { mediaKind: "embed", posterUrl: videoPoster ?? null };
  if (photoUrl) return { mediaKind: "image", imageUrl: photoUrl, posterUrl: photoUrl };
  return null;
}

export function detectVideoFromHtml(url, html) {
  const host = getHost(url);
  if (isXHost(host)) {
    if (extractMetaValue(html, "twitter:player")) return true;
    if (extractMetaValue(html, "og:video")) return true;
    if (extractMetaValue(html, "og:video:secure_url")) return true;
  }
  if (isInstagramHost(host)) {
    const parts = extractInstagramPathParts(url);
    if (parts && (parts.kind === "reel" || parts.kind === "tv")) return true;
    if (extractMetaValue(html, "og:video")) return true;
  }
  return false;
}

export function buildEmbedMedia(url, html, posterUrl) {
  const host = getHost(url);
  if (isXHost(host)) {
    const statusUrl = extractXStatusUrl(url);
    if (!statusUrl) return null;
    return {
      provider: "x",
      kind: "embed",
      embedUrl: `https://platform.twitter.com/embed/Tweet.html?dnt=1&url=${encodeURIComponent(statusUrl)}`,
      posterUrl: posterUrl ?? null,
    };
  }
  if (isInstagramHost(host)) {
    const parts = extractInstagramPathParts(url);
    if (!parts) return null;
    return {
      provider: "instagram",
      kind: "embed",
      embedUrl: `https://www.instagram.com/${parts.kind}/${parts.code}/embed/`,
      posterUrl: posterUrl ?? null,
    };
  }
  return null;
}

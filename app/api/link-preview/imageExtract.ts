export function isAmazonHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.includes("amazon.") || h.includes("amzn.") || h === "a.co";
}

export function extractMeta(html: string, property: string): string | null {
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  );
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null;
}

function decodeHtmlAttr(raw: string): string {
  return raw
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

function normalizeImageUrl(src: string | null | undefined, origin: string): string | null {
  if (!src) return null;
  const decoded = decodeHtmlAttr(src);
  if (!decoded) return null;
  const trimmed = decoded.replace(/^['"]|['"]$/g, "").trim();
  if (!trimmed) return null;
  try {
    const normalized = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
    const url = new URL(normalized, origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function extractAttr(tag: string, name: string): string | null {
  const reQuoted = new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i");
  const quoted = tag.match(reQuoted)?.[2];
  if (quoted) return quoted;
  const reBare = new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i");
  return tag.match(reBare)?.[1] ?? null;
}

function extractLinkImageSrc(html: string): string | null {
  const patterns = [
    /<link[^>]+rel=["'][^"']*image_src[^"']*["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*image_src[^"']*["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1];
    if (match) return match;
  }
  return null;
}

function extractJsonLdImage(html: string): string | null {
  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = [...html.matchAll(jsonLdPattern)];
  for (const match of matches) {
    try {
      const json = JSON.parse(match[1]);
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        if (item.image) {
          if (typeof item.image === "string") return item.image;
          if (Array.isArray(item.image) && item.image[0]) {
            return typeof item.image[0] === "string" ? item.image[0] : item.image[0]?.url ?? null;
          }
          if (typeof item.image === "object" && item.image.url) return item.image.url;
        }
        if (item.thumbnailUrl) {
          return typeof item.thumbnailUrl === "string"
            ? item.thumbnailUrl
            : item.thumbnailUrl.url ?? null;
        }
      }
    } catch {
      // Skip malformed JSON-LD blocks.
    }
  }
  return null;
}

function extractRepresentativeImg(html: string): string | null {
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  let best: { src: string; score: number } | null = null;
  for (const tag of tags) {
    const src =
      extractAttr(tag, "src") ??
      extractAttr(tag, "data-src") ??
      extractAttr(tag, "data-original") ??
      extractAttr(tag, "currentSrc");
    if (!src) continue;
    const w = Number(extractAttr(tag, "width") ?? "0");
    const h = Number(extractAttr(tag, "height") ?? "0");
    const score = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w * h : 1;
    if (!best || score > best.score) best = { src, score };
  }
  return best?.src ?? null;
}

function extractLandingImage(html: string): string | null {
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (!/\bid\s*=\s*["']landingImage["']/i.test(tag)) continue;
    return extractAttr(tag, "data-old-hires") ?? extractAttr(tag, "src");
  }
  return null;
}

function extractWrapperImage(html: string): string | null {
  const wrapper = html.match(/id=["']imgTagWrapperId["'][^>]*>[\s\S]{0,5000}?<img\b[^>]*>/i)?.[0];
  if (!wrapper) return null;
  const imgTag = wrapper.match(/<img\b[^>]*>/i)?.[0];
  if (!imgTag) return null;
  return extractAttr(imgTag, "data-old-hires") ?? extractAttr(imgTag, "src");
}

function parseAmazonDynamicMap(value: string): Array<{ url: string; area: number }> {
  try {
    const parsed = JSON.parse(decodeHtmlAttr(value));
    if (!parsed || typeof parsed !== "object") return [];
    return Object.entries(parsed)
      .map(([url, size]) => {
        const dims = Array.isArray(size) ? size : [];
        const w = Number(dims[0] ?? 0);
        const h = Number(dims[1] ?? 0);
        const area = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w * h : 0;
        return { url, area };
      })
      .filter((entry) => entry.url);
  } catch {
    return [];
  }
}

export function extractAmazonDynamicImage(html: string): string | null {
  const values: string[] = [];
  const re = /data-a-dynamic-image\s*=\s*(["'])([\s\S]*?)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    values.push(match[2]);
  }
  if (values.length === 0) return null;

  let bestUrl: string | null = null;
  let bestArea = -1;
  for (const value of values) {
    const parsed = parseAmazonDynamicMap(value);
    for (const entry of parsed) {
      if (entry.area > bestArea) {
        bestArea = entry.area;
        bestUrl = entry.url;
      }
    }
  }
  return bestUrl;
}

export function pickBestImageFromHtml(
  html: string,
  origin: string,
  hostname: string,
): string | null {
  const baseCandidates = [
    extractMeta(html, "og:image"),
    extractMeta(html, "twitter:image"),
    extractLinkImageSrc(html),
    extractJsonLdImage(html),
    extractRepresentativeImg(html),
  ];
  for (const candidate of baseCandidates) {
    const normalized = normalizeImageUrl(candidate, origin);
    if (normalized) return normalized;
  }

  if (!isAmazonHost(hostname)) return null;
  const amazonCandidates = [
    extractLandingImage(html),
    extractWrapperImage(html),
    extractAmazonDynamicImage(html),
  ];
  for (const candidate of amazonCandidates) {
    const normalized = normalizeImageUrl(candidate, origin);
    if (normalized) return normalized;
  }
  return null;
}

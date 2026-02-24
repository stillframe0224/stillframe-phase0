const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const AMAZON_CDN_HOSTS = new Set([
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "images-eu.ssl-images-amazon.com",
  "images-fe.ssl-images-amazon.com",
]);

function isAmazonHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.includes("amazon.") || h.includes("amzn.") || h === "a.co";
}

export function isAmazonCdnHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (AMAZON_CDN_HOSTS.has(h)) return true;
  return h.startsWith("image.amazon.");
}

function normalizeAmazonReferer(referrerUrl: string | null | undefined): string | null {
  if (!referrerUrl) return null;
  try {
    const parsed = new URL(referrerUrl);
    if (parsed.protocol !== "https:") return null;
    if (!isAmazonHost(parsed.hostname)) return null;
    return `${parsed.origin}/`;
  } catch {
    return null;
  }
}

export function buildAmazonImageHeaders(referrerUrl?: string | null): HeadersInit {
  return {
    "User-Agent": BROWSER_UA,
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    Referer: normalizeAmazonReferer(referrerUrl) ?? "https://www.amazon.co.jp/",
  };
}

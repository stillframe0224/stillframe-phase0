import { NextResponse } from "next/server";
import { lookup } from "dns/promises";

export const dynamic = "force-dynamic";

const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT = 4000;

// --- SSRF protection helpers ---

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => n < 0 || n > 255 || isNaN(n)))
    return true; // malformed => block
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local + metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGN)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (/^f[cd]/i.test(lower)) return true; // fc00::/7 (ULA)
  if (/^fe[89ab]/i.test(lower)) return true; // fe80::/10 (link-local)
  // IPv4-mapped ::ffff:x.x.x.x
  const v4 = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) return isPrivateIPv4(v4[1]);
  return false;
}

function stripBrackets(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]"))
    return hostname.slice(1, -1);
  return hostname;
}

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function validateUrl(url: URL): boolean {
  if (!["http:", "https:"].includes(url.protocol)) return false;
  if (url.port && url.port !== "80" && url.port !== "443") return false;
  const host = stripBrackets(url.hostname).toLowerCase();
  if (host === "localhost" || host === "0.0.0.0") return false;
  if (IPV4_RE.test(host) && isPrivateIPv4(host)) return false;
  if (host.includes(":") && isPrivateIPv6(host)) return false;
  return true;
}

async function dnsCheck(hostname: string): Promise<boolean> {
  const host = stripBrackets(hostname);
  if (IPV4_RE.test(host)) return !isPrivateIPv4(host);
  if (host.includes(":")) return !isPrivateIPv6(host);
  try {
    const results = await lookup(host, { all: true });
    if (results.length === 0) return false;
    for (const r of results) {
      if (r.family === 4 && isPrivateIPv4(r.address)) return false;
      if (r.family === 6 && isPrivateIPv6(r.address)) return false;
    }
    return true;
  } catch {
    return false;
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

      const res = await fetch(currentUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SHINEN-Bot/1.0; +https://shinen.app)",
          Accept: "text/html,application/xhtml+xml",
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

// --- Route handler ---

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (!validateUrl(parsed)) {
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

  try {
    const { res, finalUrl } = await safeFetch(url);

    if (!res.ok) {
      return NextResponse.json(
        { image: null, favicon: `${parsed.origin}/favicon.ico`, title: null },
        { headers: { "Cache-Control": "public, max-age=3600" } }
      );
    }

    const finalOrigin = new URL(finalUrl).origin;
    const html = await res.text();

    const ogImage = extractMeta(html, "og:image");
    const twImage = extractMeta(html, "twitter:image");
    const image = resolveUrl(ogImage ?? twImage, finalOrigin);
    const title = extractMeta(html, "og:title");
    const favicon = extractFavicon(html, finalOrigin);

    return NextResponse.json(
      { image, favicon, title },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  } catch (e) {
    if (e instanceof Error && e.message === "blocked") {
      return NextResponse.json({ error: "blocked_url" }, { status: 400 });
    }
    return NextResponse.json(
      { image: null, favicon: `${parsed.origin}/favicon.ico`, title: null },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  }
}

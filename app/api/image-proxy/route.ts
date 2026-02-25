import { NextResponse } from "next/server";
import { validateUrl, dnsCheck } from "@/lib/ssrf";
import { buildAmazonImageHeaders, isAmazonCdnHost } from "./amazonHeaders.mjs";
import { upgradeInstagramUrl } from "../link-preview/instagramImage.mjs";

export const dynamic = "force-dynamic";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT = 6000; // slightly longer for IG CDN
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Returns true for Instagram CDN hosts whose images require IG-style headers. */
function isInstagramCdnHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.endsWith(".cdninstagram.com") || h.endsWith(".fbcdn.net");
}

async function safeFetchImage(urlStr: string, sourcePageUrl?: string | null): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    let currentUrl = urlStr;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const hop = new URL(currentUrl);
      if (!validateUrl(hop)) throw new Error("blocked");
      if (!(await dnsCheck(hop.hostname))) throw new Error("blocked");
      const igCdn = isInstagramCdnHost(hop.hostname);
      const amazonCdn = isAmazonCdnHost(hop.hostname);

      const fetchInit: RequestInit = {
        redirect: "manual",
        signal: controller.signal,
      };
      // Only inject browser-like headers for known CDNs with anti-bot checks.
      if (igCdn) {
        fetchInit.headers = {
          "User-Agent": BROWSER_UA,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
          Referer: "https://www.instagram.com/",
        };
      } else if (amazonCdn) {
        fetchInit.headers = buildAmazonImageHeaders(sourcePageUrl);
      }

      const res = await fetch(currentUrl, fetchInit);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error("bad_redirect");
        const next = new URL(location, currentUrl);
        // Redirect must also be https (prevent downgrade to http)
        if (next.protocol !== "https:") throw new Error("blocked");
        currentUrl = next.href;
        continue;
      }

      if (!res.ok && amazonCdn) {
        console.warn(
          JSON.stringify({
            event: "image_proxy_amazon_upstream_error",
            host: hop.hostname,
            status: res.status,
          }),
        );
      }
      return res;
    }
    throw new Error("too_many_redirects");
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  const ref = searchParams.get("ref");

  if (!rawUrl) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  const url = upgradeInstagramUrl(rawUrl);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  // Proxy only accepts https — reject http/data/file/javascript/etc.
  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "https_only" }, { status: 400 });
  }

  if (!validateUrl(parsed)) {
    return NextResponse.json({ error: "blocked_url" }, { status: 400 });
  }

  try {
    const res = await safeFetchImage(url, ref);

    if (!res.ok) return new Response(null, { status: 502 });

    // Enforce image content-type
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return new Response(null, { status: 502 });

    // Early reject if content-length header exceeds limit
    const declaredLength = parseInt(res.headers.get("content-length") || "0", 10);
    if (declaredLength > MAX_SIZE) return new Response(null, { status: 413 });

    // Stream body with hard size limit
    const body = res.body;
    if (!body) return new Response(null, { status: 502 });

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SIZE) {
        reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }

    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new Response(combined, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(total),
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "blocked") {
      return NextResponse.json({ error: "blocked_url" }, { status: 400 });
    }
    console.warn(
      JSON.stringify({
        event: "image_proxy_error",
        reason: e instanceof Error ? e.message : "unknown",
        host: parsed.hostname,
      }),
    );
    return new Response(null, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { validateUrl, dnsCheck } from "@/lib/ssrf";

export const dynamic = "force-dynamic";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT = 5000;
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

async function safeFetchImage(
  urlStr: string,
  referer?: string
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    let currentUrl = urlStr;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const hop = new URL(currentUrl);
      if (!validateUrl(hop)) throw new Error("blocked");
      if (!(await dnsCheck(hop.hostname))) throw new Error("blocked");

      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      };
      if (referer) headers["Referer"] = referer;

      const res = await fetch(currentUrl, {
        headers,
        redirect: "manual",
        signal: controller.signal,
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error("bad_redirect");
        currentUrl = new URL(location, currentUrl).href;
        continue;
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
  const url = searchParams.get("url");
  const ref = searchParams.get("ref");

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

  // Validate ref — only allow http/https as Referer
  let referer: string | undefined;
  if (ref) {
    try {
      const refUrl = new URL(ref);
      if (["http:", "https:"].includes(refUrl.protocol)) referer = ref;
    } catch {
      /* invalid ref, ignore */
    }
  }

  try {
    const res = await safeFetchImage(url, referer);

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
    return new Response(null, { status: 502 });
  }
}

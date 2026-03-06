import { NextResponse } from "next/server";

const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/;

// Fallback gradient image (data URI)
const FALLBACK_IMAGE = 
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234f46e5'/%3E%3Cstop offset='100%25' style='stop-color:%236366f1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='630' fill='url(%23g)'/%3E%3C/svg%3E";

async function fetchWithRetry(
  url: string,
  maxAttempts = 2
): Promise<{ html: string; attempt: number } | null> {
  const timeouts = [5000, 8000]; // Progressive timeout: 5s → 8s

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "SHINEN-Bot/1.0 (OGP fetcher)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(timeouts[i] || 8000),
      });

      if (!res.ok) {
        // Retry on server errors (5xx), but not client errors (4xx)
        if (res.status >= 500 && i < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (i + 1))); // 1s, 2s backoff
          continue;
        }
        return null;
      }

      const html = await res.text();
      return { html, attempt: i + 1 };
    } catch (e) {
      // Retry on timeout or network errors
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      console.error(`[og-image] Fetch failed after ${maxAttempts} attempts:`, e);
      return null;
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "invalid protocol" }, { status: 400 });
    }

    // YouTube shortcut — return hqdefault (always available)
    const ytMatch = url.match(YT_RE);
    if (ytMatch) {
      return NextResponse.json({
        image: `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`,
        title: null,
      });
    }

    const result = await fetchWithRetry(url);

    if (!result) {
      // Fetch failed after retries → return fallback
      return NextResponse.json({
        image: FALLBACK_IMAGE,
        title: null,
        fallback: true,
      });
    }

    const { html, attempt } = result;

    // Extract og:image
    const ogMatch =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
      );

    // Extract og:title
    const titleMatch =
      html.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
      );

    const image = ogMatch?.[1] || FALLBACK_IMAGE;
    const title = titleMatch?.[1] || null;

    return NextResponse.json({
      image,
      title,
      fallback: !ogMatch,
      attempt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json(
      { image: FALLBACK_IMAGE, error: message, fallback: true },
      { status: 500 }
    );
  }
}

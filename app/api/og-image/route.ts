import { NextResponse } from "next/server";

const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/;

function logOgImageError(context: {
  event: string;
  url?: string;
  hostname?: string;
  status?: number;
  error?: string;
  duration_ms?: number;
  type?: string;
}) {
  console.error(JSON.stringify({ ...context, timestamp: new Date().toISOString() }));
}

export async function POST(request: Request) {
  const startTime = Date.now();
  let parsedUrl: URL | null = null;

  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      logOgImageError({ event: "og_image_validation_failed", error: "url_required" });
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    // Validate URL
    try {
      parsedUrl = new URL(url);
    } catch {
      logOgImageError({ event: "og_image_validation_failed", error: "invalid_url", url });
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      logOgImageError({
        event: "og_image_validation_failed",
        error: "invalid_protocol",
        url,
        hostname: parsedUrl.hostname,
      });
      return NextResponse.json({ error: "invalid protocol" }, { status: 400 });
    }

    // YouTube shortcut — return hqdefault (always available) instead of maxresdefault (sometimes 404)
    const ytMatch = url.match(YT_RE);
    if (ytMatch) {
      return NextResponse.json({
        image: `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`,
        title: null,
      });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "SHINEN-Bot/1.0 (OGP fetcher)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const duration = Date.now() - startTime;
      logOgImageError({
        event: "og_image_fetch_failed",
        url,
        hostname: parsedUrl.hostname,
        status: res.status,
        error: res.statusText,
        duration_ms: duration,
      });
      return NextResponse.json(
        { error: "fetch_failed", image: null, title: null, retryAfterMs: 5 * 60 * 1000 },
        { status: 502 }
      );
    }

    const html = await res.text();

    // Extract og:image
    const ogMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
      );

    // Extract og:title as fallback info
    const titleMatch = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
      );

    const image = ogMatch?.[1] || null;
    const title = titleMatch?.[1] || null;

    if (!image) {
      logOgImageError({
        event: "og_image_not_found",
        url,
        hostname: parsedUrl.hostname,
        duration_ms: Date.now() - startTime,
      });
    }

    return NextResponse.json({ image, title });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    const isTimeout = e instanceof Error && e.name === "TimeoutError";
    const duration = Date.now() - startTime;

    logOgImageError({
      event: "og_image_exception",
      error: message,
      hostname: parsedUrl?.hostname,
      duration_ms: duration,
      type: isTimeout ? "timeout" : "error",
    });
    return NextResponse.json(
      {
        error: isTimeout ? "timeout" : "internal_error",
        image: null,
        title: null,
        retryAfterMs: 5 * 60 * 1000,
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}

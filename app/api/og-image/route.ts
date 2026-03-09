import { NextResponse } from "next/server";

const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/;

const DEFAULT_IMAGE = "/enso.png"; // Fallback image when OGP not found
const DEFAULT_TITLE = "SHINEN"; // Fallback title

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
      // Fetch failed → return fallback
      return NextResponse.json({
        image: DEFAULT_IMAGE,
        title: DEFAULT_TITLE,
        fallback: true,
      });
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

    const image = ogMatch?.[1] || DEFAULT_IMAGE;
    const title = titleMatch?.[1] || null;

    return NextResponse.json({ image, title });
  } catch (e) {
    // Error → return fallback instead of 500
    return NextResponse.json({
      image: DEFAULT_IMAGE,
      title: DEFAULT_TITLE,
      fallback: true,
      error: e instanceof Error ? e.message : "unknown error",
    });
  }
}

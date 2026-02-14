import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

function extractMeta(html: string, property: string): string | null {
  // Match both <meta property="X" content="Y"> and <meta content="Y" property="X">
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
  // Look for <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
  const match = html.match(
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

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "invalid protocol" }, { status: 400 });
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
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SHINEN-Bot/1.0; +https://shinen.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { image: null, favicon: `${parsed.origin}/favicon.ico`, title: null },
        { headers: { "Cache-Control": "public, max-age=3600" } }
      );
    }

    const finalOrigin = new URL(res.url).origin;
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
  } catch {
    return NextResponse.json(
      { image: null, favicon: `${parsed.origin}/favicon.ico`, title: null },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  }
}

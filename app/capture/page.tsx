'use client';

import { useEffect } from 'react';
import { pickBestImageFromHtml } from '../api/link-preview/imageExtract.mjs';

interface LinkPreviewResponse {
  image?: string | null;
  title?: string | null;
  favicon?: string | null;
  mediaKind?: 'image' | 'embed';
  embedUrl?: string | null;
  posterUrl?: string | null;
  provider?: 'youtube' | 'x' | 'instagram';
}

function normalizeMaybeUrl(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  let candidate = raw;
  if (candidate.startsWith('//')) candidate = `https:${candidate}`;
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?$/i.test(candidate)) {
      candidate = `https://${candidate.replace(/^www\./i, 'www.')}`;
    } else {
      return null;
    }
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function buildAutoRedirectUrl(opts: {
  url: string;
  title: string;
  image?: string | null;
  favicon?: string | null;
  site?: string | null;
  desc?: string | null;
  mediaKind?: 'image' | 'embed' | null;
  embedUrl?: string | null;
  posterUrl?: string | null;
  provider?: 'youtube' | 'x' | 'instagram' | null;
}): string {
  const p = new URLSearchParams();
  p.set('auto', '1');
  p.set('url', opts.url);
  p.set('title', opts.title.slice(0, 200));
  if (opts.image) {
    const trimmed = opts.image.slice(0, 2000);
    p.set('img', trimmed);
    p.set('image', trimmed);
  }
  if (opts.favicon) p.set('favicon', opts.favicon.slice(0, 2000));
  if (opts.site) p.set('site', opts.site.slice(0, 100));
  if (opts.desc) p.set('desc', opts.desc.slice(0, 300));
  if (opts.posterUrl) p.set('poster', opts.posterUrl.slice(0, 2000));
  if (opts.mediaKind === 'embed' && opts.embedUrl) {
    p.set('mk', 'embed');
    p.set('embed', opts.embedUrl.slice(0, 2000));
  }
  if (opts.provider) p.set('provider', opts.provider);
  return `/app?${p.toString()}`;
}

export default function CapturePage() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const rawQueryUrl = params.get('url');
      const normalizedQueryUrl = rawQueryUrl ? normalizeMaybeUrl(rawQueryUrl) : null;
      const targetUrl = normalizedQueryUrl ?? (rawQueryUrl ? rawQueryUrl.trim() : '');

      // Preferred path: /capture?url=<target> -> /api/link-preview -> /app?auto=1...
      if (targetUrl) {
        let site = '';
        try {
          site = new URL(targetUrl).hostname;
        } catch {
          site = '';
        }
        const sharedTitle = (params.get('title') || '').trim();
        const sharedText = (params.get('text') || '').trim();
        let preview: LinkPreviewResponse | null = null;

        try {
          const res = await fetch(`/api/link-preview?url=${encodeURIComponent(targetUrl)}`);
          if (res.ok) {
            preview = (await res.json()) as LinkPreviewResponse;
          }
        } catch {
          // Ignore preview fetch errors; continue with minimal redirect.
        }

        if (cancelled) return;
        const finalTitle = sharedTitle || preview?.title || site || targetUrl;
        const redirectUrl = buildAutoRedirectUrl({
          url: targetUrl,
          title: finalTitle,
          image: preview?.image ?? null,
          favicon: preview?.favicon ?? null,
          site,
          desc: sharedText || null,
          mediaKind: preview?.mediaKind ?? null,
          embedUrl: preview?.embedUrl ?? null,
          posterUrl: preview?.posterUrl ?? null,
          provider: preview?.provider ?? null,
        });
        window.location.href = redirectUrl;
        return;
      }

      // Bookmarklet fallback: capture current page via referrer + DOM extraction.
      const referrerUrl = document.referrer || window.location.href;
      const pageTitle = document.title;
      let site = '';
      try {
        site = new URL(referrerUrl).hostname;
      } catch {
        site = '';
      }
      let img = '';
      try {
        const page = new URL(referrerUrl);
        const html = document.documentElement?.outerHTML ?? '';
        const extracted = pickBestImageFromHtml(html, page.origin, page.hostname);
        if (typeof extracted === 'string' && /^https?:\/\//i.test(extracted)) {
          img = extracted.slice(0, 2000);
        }
      } catch {
        // Ignore parse/extract failures; fallback is no image.
      }
      if (cancelled) return;
      window.location.href = buildAutoRedirectUrl({
        url: referrerUrl,
        title: pageTitle,
        image: img || null,
        site,
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'sans-serif'
    }}>
      <p>Capturing page...</p>
    </div>
  );
}

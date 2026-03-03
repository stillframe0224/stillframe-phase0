'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

function CaptureInner() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Web Share Target path (or explicit deep-link): /capture?url=...
      const rawQueryUrl = params.get('url') || params.get('text') || '';
      const normalizedQueryUrl = rawQueryUrl ? normalizeMaybeUrl(rawQueryUrl) : null;
      const targetUrl = normalizedQueryUrl ?? rawQueryUrl.trim();

      if (targetUrl) {
        let site = '';
        try {
          site = new URL(targetUrl).hostname;
        } catch {
          site = '';
        }

        const sharedTitle = (params.get('title') || '').trim();
        const sharedTextRaw = (params.get('text') || '').trim();
        const sharedDesc = sharedTextRaw && sharedTextRaw !== rawQueryUrl ? sharedTextRaw : null;
        let preview: LinkPreviewResponse | null = null;

        try {
          const res = await fetch(`/api/link-preview?url=${encodeURIComponent(targetUrl)}`);
          if (res.ok) preview = (await res.json()) as LinkPreviewResponse;
        } catch {
          // Ignore preview fetch errors; continue with minimal redirect.
        }

        if (cancelled) return;
        const dest = buildAutoRedirectUrl({
          url: targetUrl,
          title: sharedTitle || preview?.title || site || targetUrl,
          image: preview?.image ?? null,
          favicon: preview?.favicon ?? null,
          site,
          desc: sharedDesc,
          mediaKind: preview?.mediaKind ?? null,
          embedUrl: preview?.embedUrl ?? null,
          posterUrl: preview?.posterUrl ?? null,
          provider: preview?.provider ?? null,
        });
        router.replace(dest);
        return;
      }

      // Legacy fallback: browser extension/direct navigation + DOM extraction.
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
      router.replace(buildAutoRedirectUrl({
        url: referrerUrl,
        title: pageTitle,
        image: img || null,
        site,
      }));
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      color: '#666',
    }}>
      <p>Capturing…</p>
    </div>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#666' }}><p>Capturing…</p></div>}>
      <CaptureInner />
    </Suspense>
  );
}

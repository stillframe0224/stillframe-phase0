'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { pickBestImageFromHtml } from '../api/link-preview/imageExtract.mjs';

function CaptureInner() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Web Share Target: query params injected by the OS share sheet
    const shareUrl = params.get('url') || params.get('text') || '';
    const shareTitle = params.get('title') || '';

    if (shareUrl) {
      // Came from Web Share Target — redirect immediately with the shared data
      const dest = `/app?auto=1${shareUrl ? `&url=${encodeURIComponent(shareUrl)}` : ''}${shareTitle ? `&title=${encodeURIComponent(shareTitle)}` : ''}`;
      router.replace(dest);
      return;
    }

    // Legacy: browser extension / direct navigation — use document.referrer
    const referrerUrl = document.referrer || window.location.href;
    const pageTitle = document.title;
    const url = encodeURIComponent(referrerUrl);
    const title = encodeURIComponent(pageTitle.slice(0, 200));

    let img = "";
    try {
      const page = new URL(referrerUrl);
      const html = document.documentElement?.outerHTML ?? "";
      const extracted = pickBestImageFromHtml(html, page.origin, page.hostname);
      if (typeof extracted === "string" && /^https?:\/\//i.test(extracted)) {
        img = extracted.slice(0, 2000);
      }
    } catch {
      // Ignore parse/extract failures; fallback is no image.
    }

    const redirectUrl = `/app?auto=1&url=${url}&title=${title}${img ? `&img=${encodeURIComponent(img)}` : ''}`;
    window.location.href = redirectUrl;
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

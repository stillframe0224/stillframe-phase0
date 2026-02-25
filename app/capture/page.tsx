'use client';

import { useEffect } from 'react';
import { pickBestImageFromHtml } from '../api/link-preview/imageExtract.mjs';

export default function CapturePage() {
  useEffect(() => {
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

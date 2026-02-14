'use client';

import { useEffect } from 'react';

export default function CapturePage() {
    useEffect(() => {
          // Get referrer URL and document title
                  const referrerUrl = document.referrer || window.location.href;
          const pageTitle = document.title;

                  // Encode parameters
                  const url = encodeURIComponent(referrerUrl);
          const title = encodeURIComponent(pageTitle.slice(0, 200));

                  // Extract image from various sources
                  let img = '';

                  // Helper functions
                  const pickMeta = (sel: string, attr: string): string => {
                          const el = document.querySelector(sel);
                          return el ? (el.getAttribute(attr) || '') : '';
                  };

                  const isHttp = (x: string | null): boolean => {
                          return /^https?:\/\//i.test(x || '');
                  };

                  // Try OG image first
                  const og = pickMeta('meta[property="og:image"],meta[property="og:image:secure_url"]', 'content') ||
                                    pickMeta('meta[name="twitter:image"],meta[property="twitter:image"]', 'content') ||
                                    pickMeta('link[rel="image_src"]', 'href');

                  if (isHttp(og)) {
                          img = og;
                  }

                  // Build redirect URL
                  const redirectUrl = `/app?auto=1&url=${url}&title=${title}${img ? `&img=${encodeURIComponent(img.slice(0, 2000))}` : ''}`;

                  // Redirect
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
                <p>Capturing page...</p>p>
        </div>div>
      );
}</p>

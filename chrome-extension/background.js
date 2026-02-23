// Save to SHINEN - Background Script (MV3)
// When popup is enabled (manifest "default_popup"), onClicked does NOT fire.
// Kept as fallback + for extractPageData/buildShinenUrl reuse.

const RESTRICTED_URL_PATTERNS = [
  /^$/,
  /^chrome:/i,
  /^chrome-extension:/i,
  /^edge:/i,
  /^about:/i,
  /^file:/i,
  /^view-source:/i,
];

function isRestrictedUrl(rawUrl) {
  if (!rawUrl) return true;
  return RESTRICTED_URL_PATTERNS.some((re) => re.test(rawUrl));
}

chrome.action.onClicked.addListener(async (tab) => {
  const tabUrl = tab.url || tab.pendingUrl || '';

  if (isRestrictedUrl(tabUrl)) {
    await chrome.tabs.create({
      url: 'https://stillframe-phase0.vercel.app/app?auto=1&reason=restricted_url',
    });
    return;
  }

  try {
    const url = tabUrl;
    const title = tab.title || '';

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageData,
    });

    const extracted = results[0]?.result || {};
    const { site = '', img = '', sel = '' } = extracted;

    const shinenUrl = buildShinenUrl(url, title, img, site, sel);
    await chrome.tabs.create({ url: shinenUrl });

  } catch (error) {
    console.error('Save to SHINEN failed:', error);
    const safeUrl = isRestrictedUrl(tab.url) ? '' : (tab.url || '');
    const fallbackUrl = `https://stillframe-phase0.vercel.app/app?auto=1&url=${encodeURIComponent(safeUrl)}`;
    await chrome.tabs.create({ url: fallbackUrl });
  }
});

/**
 * Content extraction function (runs in page context)
 */
function extractPageData() {
  function norm(raw) {
    if (!raw) return null;
    let x = raw.trim();
    if (!x) return null;

    if (x.includes('%2F') || x.includes('%3A')) {
      try {
        const decoded = decodeURIComponent(x);
        if (/^https?:\/\//.test(decoded) || /^\/\//.test(decoded)) {
          x = decoded;
        }
      } catch (e) {
        // malformed, continue
      }
    }

    if (x.startsWith('//')) {
      x = 'https:' + x;
    }

    if (x.startsWith('/')) {
      try {
        x = new URL(x, location.href).href;
      } catch (e) {
        return null;
      }
    }

    if (!/^https?:\/\//.test(x)) {
      return null;
    }

    return x.slice(0, 2000);
  }

  const siteMeta = document.querySelector('meta[property="og:site_name"]');
  const site = (siteMeta?.content || '').slice(0, 100);

  const sel = (window.getSelection()?.toString() || '').slice(0, 1200);

  const candidates = [];

  function add(v) {
    if (!v) return;
    if (typeof v === 'string') {
      candidates.push(v);
    } else if (Array.isArray(v)) {
      v.forEach(add);
    } else if (v.url) {
      candidates.push(v.url);
    }
  }

  const metas = document.querySelectorAll(
    'meta[property="og:image"],' +
    'meta[property="og:image:secure_url"],' +
    'meta[property="og:image:url"],' +
    'meta[name="twitter:image"],' +
    'meta[property="twitter:image"]'
  );
  metas.forEach((m) => add(m.content));

  const lnk = document.querySelector('link[rel="image_src"]');
  if (lnk) add(lnk.href);

  const lds = document.querySelectorAll('script[type="application/ld+json"]');
  lds.forEach((ld) => {
    try {
      const j = JSON.parse(ld.textContent || '{}');
      if (j['@graph']) {
        j['@graph'].forEach((g) => {
          add(g.image || g.thumbnailUrl);
        });
      } else {
        add(j.image || j.thumbnailUrl);
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  const azLanding = document.querySelector('#landingImage');
  if (azLanding) {
    const hires = azLanding.getAttribute('data-old-hires');
    if (hires) add(hires);

    const dynImg = azLanding.getAttribute('data-a-dynamic-image');
    if (dynImg) {
      try {
        const obj = JSON.parse(dynImg);
        const keys = Object.keys(obj);
        if (keys.length) {
          keys.sort((a, b) => (obj[b][0] * obj[b][1]) - (obj[a][0] * obj[a][1]));
          add(keys[0]);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  const azWrap = document.querySelector('#imgTagWrapperId img');
  if (azWrap) {
    add(azWrap.src || azWrap.getAttribute('data-a-dynamic-image'));
  }

  const azMobile = document.querySelectorAll('img[data-a-dynamic-image]');
  azMobile.forEach((im) => {
    const dd = im.getAttribute('data-a-dynamic-image');
    if (dd) {
      try {
        const oo = JSON.parse(dd);
        const kks = Object.keys(oo);
        if (kks.length) {
          kks.sort((a, b) => (oo[b][0] * oo[b][1]) - (oo[a][0] * oo[a][1]));
          add(kks[0]);
        }
      } catch (e) {
        // ignore
      }
    }
  });

  let fanzaBest = null;
  const imgs = document.querySelectorAll('img');
  imgs.forEach((im) => {
    const src =
      im.currentSrc ||
      im.src ||
      im.getAttribute('data-src') ||
      im.getAttribute('data-original') ||
      '';
    if (src && (src.includes('pics.dmm.co.jp') || src.includes('dmm.co.jp'))) {
      const area = im.naturalWidth * im.naturalHeight;
      if (!fanzaBest || area > 5000) {
        fanzaBest = src;
      }
    }
  });
  if (fanzaBest) candidates.unshift(fanzaBest);

  let img = '';
  for (const c of candidates) {
    const n = norm(c);
    if (n) {
      img = n;
      break;
    }
  }

  return { site, img, sel };
}

/**
 * Build SHINEN URL with proper encoding
 */
function buildShinenUrl(url, title, img, site, sel) {
  const base = 'https://stillframe-phase0.vercel.app/app';
  const params = new URLSearchParams();

  params.set('auto', '1');
  params.set('url', url.slice(0, 2000));
  params.set('title', title.slice(0, 200));

  if (img) params.set('img', img.slice(0, 2000));
  if (site) params.set('site', site.slice(0, 100));
  if (sel) params.set('s', sel.slice(0, 1200));

  return `${base}?${params.toString()}`;
}

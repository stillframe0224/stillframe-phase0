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
    const {
      canonicalUrl = url,
      site = '',
      img = '',
      poster = '',
      mk = '',
      embed = '',
      provider = '',
      sel = '',
    } = extracted;

    const shinenUrl = buildShinenUrl(canonicalUrl, title, img, poster, mk, embed, provider, site, sel);
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
  function canonicalUrl(raw) {
    try {
      const p = new URL(raw);
      p.hash = '';
      const drop = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'fbclid', 'gclid'];
      for (const key of drop) p.searchParams.delete(key);
      return p.toString();
    } catch {
      return raw;
    }
  }

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

  function upgradeInstagram(raw) {
    if (!raw) return raw;
    let host = '';
    try {
      host = new URL(raw, location.href).hostname.toLowerCase();
    } catch {
      return raw;
    }
    if (!(host.includes('instagram.') || host.includes('cdninstagram.com') || host.includes('fbcdn.net'))) return raw;
    return raw.replace(/([/_])(p|s)(150|240|320|480|540|640|720|750)x\3(?=([/_\\.-]|$))/gi, '$1$21080x1080');
  }

  function upgradeXOrig(raw) {
    const abs = norm(raw);
    if (!abs) return null;
    try {
      const p = new URL(abs);
      if (!p.hostname.toLowerCase().includes('twimg.com')) return p.toString();
      p.pathname = p.pathname.replace(/:(small|medium|large|orig)$/i, ':orig');
      const name = (p.searchParams.get('name') || '').toLowerCase();
      if (!name || name === 'small' || name === 'medium' || name === 'large' || name === 'thumb') {
        p.searchParams.set('name', 'orig');
      }
      return p.toString();
    } catch {
      return abs;
    }
  }

  function isUiAsset(src) {
    const low = String(src || '').toLowerCase();
    if (!low) return true;
    if (low.startsWith('data:')) return true;
    if (/\.svg(\?|$)/i.test(low)) return true;
    return /(favicon|sprite|emoji|icon|avatar|profile)/i.test(low);
  }

  function parseSrcsetMax(raw) {
    if (!raw) return null;
    let best = null;
    let bestW = 0;
    for (const entry of String(raw).split(',')) {
      const part = entry.trim();
      if (!part) continue;
      const bits = part.split(/\s+/).filter(Boolean);
      if (!bits.length) continue;
      const src = norm(bits[0]);
      if (!src || isUiAsset(src)) continue;
      const descriptor = bits[bits.length - 1] || '';
      const w = /^\d+w$/i.test(descriptor) ? Number(descriptor.slice(0, -1)) : 1;
      if (!best || w > bestW) {
        best = { src, w };
        bestW = w;
      }
    }
    return best;
  }

  function pickLargestNatural(matchFn) {
    let best = null;
    const imgs = document.querySelectorAll('img');
    imgs.forEach((im) => {
      const src = im.currentSrc || im.src || im.getAttribute('data-src') || im.getAttribute('data-original') || '';
      const n = norm(src);
      if (!n || isUiAsset(n)) return;
      if (typeof matchFn === 'function' && !matchFn(n, im)) return;
      const area = Number(im.naturalWidth || 0) * Number(im.naturalHeight || 0);
      if (!best || area > best.area) best = { src: n, area };
    });
    return best ? best.src : null;
  }

  function detectXEmbed(sourceUrl) {
    try {
      const p = new URL(sourceUrl);
      const host = p.hostname.toLowerCase();
      if (!(host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com'))) return null;
      const m = p.pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)/i);
      if (!m) return null;
      const tweetUrl = 'https://x.com/' + m[1] + '/status/' + m[2];
      return 'https://platform.twitter.com/embed/Tweet.html?dnt=1&url=' + encodeURIComponent(tweetUrl);
    } catch {
      return null;
    }
  }

  function detectInstagramEmbed(sourceUrl) {
    try {
      const p = new URL(sourceUrl);
      const host = p.hostname.toLowerCase();
      if (!(host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am')) return null;
      const m = p.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i);
      if (!m) return null;
      return 'https://www.instagram.com/' + m[1].toLowerCase() + '/' + m[2] + '/embed/';
    } catch {
      return null;
    }
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

  const sourceUrl = canonicalUrl(location.href);
  const host = (location.hostname || '').toLowerCase();
  let mk = '';
  let embed = '';
  let provider = '';
  let poster = '';
  let img = '';

  if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) {
    embed = detectXEmbed(sourceUrl) || '';
    provider = embed ? 'x' : '';
    mk = embed ? 'embed' : '';
    let bestPoster = '';
    let bestVideoArea = 0;
    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      const next = upgradeXOrig(video.poster || video.getAttribute('poster') || '');
      if (!next) return;
      const area = Number(video.videoWidth || video.width || 0) * Number(video.videoHeight || video.height || 0);
      if (!bestPoster || area >= bestVideoArea) {
        bestPoster = next;
        bestVideoArea = area;
      }
    });
    const bestImage = pickLargestNatural((src) => {
      try {
        const p = new URL(src);
        return p.hostname.includes('pbs.twimg.com') && /\/media\//i.test(p.pathname);
      } catch {
        return false;
      }
    });
    img = bestImage ? upgradeXOrig(bestImage) : '';
    poster = bestPoster || img || '';
  } else if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') {
    const srcsetNodes = document.querySelectorAll('img[srcset]');
    let bestSrcset = '';
    let bestW = 0;
    srcsetNodes.forEach((node) => {
      const candidate = parseSrcsetMax(node.getAttribute('srcset') || node.srcset || '');
      if (!candidate) return;
      const w = Number(candidate.w || 1);
      if (!bestSrcset || w > bestW) {
        bestSrcset = candidate.src;
        bestW = w;
      }
    });
    const natural = pickLargestNatural();
    img = upgradeInstagram(bestSrcset || natural || '');
    poster = img || '';
    const isReel = /\/(reel|tv)\//i.test(location.pathname || '');
    if (isReel) {
      embed = detectInstagramEmbed(sourceUrl) || '';
      provider = embed ? 'instagram' : '';
      mk = embed ? 'embed' : '';
    }
  }

  const isXLikeHost = host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com');
  const isInstagramLikeHost = host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am';
  const skipGenericFallback = Boolean(isXLikeHost || isInstagramLikeHost);
  if (!img && !skipGenericFallback) {
    for (const c of candidates) {
      const n = norm(c);
      if (n) {
        img = n;
        break;
      }
    }
  }
  if (!poster) poster = img || '';
  if (img && host.includes('instagram')) img = upgradeInstagram(img);

  return { canonicalUrl: sourceUrl, site, img, poster, mk, embed, provider, sel };
}

/**
 * Build SHINEN URL with proper encoding
 */
function buildShinenUrl(url, title, img, poster, mk, embed, provider, site, sel) {
  const base = 'https://stillframe-phase0.vercel.app/app';
  const params = new URLSearchParams();

  params.set('auto', '1');
  params.set('url', url.slice(0, 2000));
  params.set('title', title.slice(0, 200));

  if (img) params.set('img', img.slice(0, 2000));
  if (poster) params.set('poster', poster.slice(0, 2000));
  if (mk) params.set('mk', mk);
  if (embed) params.set('embed', embed.slice(0, 2000));
  if (provider) params.set('provider', provider);
  if (site) params.set('site', site.slice(0, 100));
  if (sel) params.set('s', sel.slice(0, 1200));

  return `${base}?${params.toString()}`;
}

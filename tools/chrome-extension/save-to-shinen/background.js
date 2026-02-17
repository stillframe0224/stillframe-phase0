// Save to SHINEN - Background Script (MV3)

const OFFSCREEN_AUDIO_PATH = 'offscreen_audio.html';
let creatingOffscreenDocument = null;
const BADGE_CLEAR_MS = 1000;
const NOTIFY_CLEAR_MS = 2000;
const NOTIFY_ICON = 'icon128.png';

function flashBadge(kind, tabId) {
  const text = kind === 'fail' ? '!' : '•';
  const color = kind === 'fail' ? '#B00020' : '#222222';
  const target = typeof tabId === 'number' ? { tabId } : {};

  try {
    chrome.action.setBadgeBackgroundColor({ ...target, color });
    chrome.action.setBadgeText({ ...target, text });
    setTimeout(() => {
      try {
        chrome.action.setBadgeText({ ...target, text: '' });
      } catch (_error) {
        // Ignore badge clear failures.
      }
    }, BADGE_CLEAR_MS);
  } catch (_error) {
    // Ignore badge failures so beep flow is unaffected.
  }
}

function notify(kind) {
  try {
    const id = `sf_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const isFail = kind === 'fail';
    const isApproval = kind === 'approval';
    chrome.notifications.create(
      id,
      {
        type: 'basic',
        iconUrl: NOTIFY_ICON,
        title: isApproval ? 'SHINEN: action required' : isFail ? 'SHINEN: fail' : 'SHINEN: done',
        message: isApproval
          ? 'Approval prompt is waiting (Yes/No).'
          : isFail
            ? 'beep event (fail)'
            : 'beep event (done)',
        silent: false,
      },
      () => {}
    );

    setTimeout(() => {
      try {
        chrome.notifications.clear(id, () => {});
      } catch (_error) {
        // Ignore notification clear failures.
      }
    }, NOTIFY_CLEAR_MS);
  } catch (_error) {
    // Ignore notification failures so beep flow is unaffected.
  }
}

async function hasOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_AUDIO_PATH);

  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl],
    });
    return contexts.length > 0;
  }

  if (typeof clients === 'undefined' || typeof clients.matchAll !== 'function') {
    return false;
  }

  const matchedClients = await clients.matchAll();
  return matchedClients.some((client) => {
    const url = client && client.url ? client.url : '';
    return url.includes(chrome.runtime.id) && url.includes(OFFSCREEN_AUDIO_PATH);
  });
}

async function setupOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }

  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
    return;
  }

  creatingOffscreenDocument = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_AUDIO_PATH,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play beep sounds on completion events',
    })
    .catch((error) => {
      const message = String((error && error.message) || error || '');
      if (!message.includes('Only a single offscreen document may be created')) {
        throw error;
      }
    })
    .finally(() => {
      creatingOffscreenDocument = null;
    });

  await creatingOffscreenDocument;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) {
    return;
  }

  if (msg.type === 'SF_ALERT' && msg.kind === 'approval') {
    try {
      notify('approval');
    } catch (_error) {
      // Ignore alert notification failures.
    }
    return;
  }

  if (msg.type !== 'SF_BEEP' || msg.from !== 'content') {
    return;
  }

  (async () => {
    try {
      const kind = msg.kind === 'fail' ? 'fail' : 'success';
      flashBadge(kind, sender && sender.tab ? sender.tab.id : undefined);
      notify(kind);
      await setupOffscreenDocument();
      await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'SF_BEEP',
        kind,
      });
      sendResponse({ ok: true });
    } catch (error) {
      console.error('Offscreen beep relay failed:', error);
      sendResponse({ ok: false, reason: String((error && error.message) || error) });
    }
  })();

  return true;
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Get basic tab info
    const url = tab.url || '';
    const title = tab.title || '';

    // Execute content extraction script in the active tab
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageData,
    });

    const extracted = results[0]?.result || {};
    const { site = '', img = '', sel = '' } = extracted;

    // Build SHINEN URL
    const shinenUrl = buildShinenUrl(url, title, img, site, sel);

    // Open in new tab
    await chrome.tabs.create({ url: shinenUrl });

  } catch (error) {
    console.error('Save to SHINEN failed:', error);
    // Fallback: open SHINEN with minimal params
    const fallbackUrl = `https://stillframe-phase0.vercel.app/app?auto=1&url=${encodeURIComponent(tab.url || '')}`;
    await chrome.tabs.create({ url: fallbackUrl });
  }
});

/**
 * Content extraction function (runs in page context)
 */
function extractPageData() {
  // Helper: normalize URL
  function norm(raw) {
    if (!raw) return null;
    let x = raw.trim();
    if (!x) return null;

    // Decode if double-encoded
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

    // Protocol-relative
    if (x.startsWith('//')) {
      x = 'https:' + x;
    }

    // Relative path
    if (x.startsWith('/')) {
      try {
        x = new URL(x, location.href).href;
      } catch (e) {
        return null;
      }
    }

    // Accept only http/https
    if (!/^https?:\/\//.test(x)) {
      return null;
    }

    return x.slice(0, 2000);
  }

  // Extract site name
  const siteMeta = document.querySelector('meta[property="og:site_name"]');
  const site = (siteMeta?.content || '').slice(0, 100);

  // Extract selection
  const sel = (window.getSelection()?.toString() || '').slice(0, 1200);

  // Extract best image
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

  // 1. Meta tags
  const metas = document.querySelectorAll(
    'meta[property="og:image"],' +
    'meta[property="og:image:secure_url"],' +
    'meta[property="og:image:url"],' +
    'meta[name="twitter:image"],' +
    'meta[property="twitter:image"]'
  );
  metas.forEach((m) => add(m.content));

  // 2. Link rel=image_src
  const lnk = document.querySelector('link[rel="image_src"]');
  if (lnk) add(lnk.href);

  // 3. JSON-LD (all blocks)
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

  // 4. Amazon-specific
  const azLanding = document.querySelector('#landingImage');
  if (azLanding) {
    // data-old-hires
    const hires = azLanding.getAttribute('data-old-hires');
    if (hires) add(hires);

    // data-a-dynamic-image (pick largest by area)
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

  // #imgTagWrapperId
  const azWrap = document.querySelector('#imgTagWrapperId img');
  if (azWrap) {
    add(azWrap.src || azWrap.getAttribute('data-a-dynamic-image'));
  }

  // img[data-a-dynamic-image] (mobile)
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

  // 5. FANZA/DMM-specific (prefer pics.dmm.co.jp, pick largest)
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
  if (fanzaBest) candidates.unshift(fanzaBest); // Add to front

  // 6. Normalize and pick first valid
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

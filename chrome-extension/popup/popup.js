// Save to SHINEN — Popup Script
import { isRestrictedUrl } from "../lib/restricted-url.js";
import { enqueue, getQueue, migrateFromLocalStorage } from "../lib/queue.js";

const SHINEN_BASE = "https://stillframe-phase0.vercel.app/app";

async function init() {
  const contentEl = document.getElementById("content");

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url ?? tab?.pendingUrl ?? "";

  // A) Popup Guard — restricted URL check
  if (isRestrictedUrl(tabUrl)) {
    contentEl.innerHTML = `
      <div class="restricted-msg">
        This page cannot be saved (internal browser page).
        <br><br>
        Navigate to a regular web page to save it to SHINEN.
      </div>
    `;
    return; // Early exit — no save button, no extraction
  }

  // Migrate localStorage queue (one-time)
  await migrateFromLocalStorage(chrome.storage.local);

  const title = tab.title || "";
  const url = tabUrl;

  // Show preview
  contentEl.innerHTML = `
    <div class="preview">
      <div class="title">${escapeHtml(title.slice(0, 80))}</div>
      <div class="url">${escapeHtml(url.slice(0, 100))}</div>
    </div>
    <button id="save-btn">Save to SHINEN</button>
    <div id="status"></div>
    <div class="queue-count" id="queue-count"></div>
  `;

  // Show queue count
  await updateQueueCount();

  // Save button handler
  document.getElementById("save-btn").addEventListener("click", async () => {
    const btn = document.getElementById("save-btn");
    const statusEl = document.getElementById("status");
    btn.disabled = true;
    statusEl.textContent = "Saving...";

    try {
      // Extract page data via scripting
      let extracted = {};
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractPageData,
        });
        extracted = results[0]?.result || {};
      } catch (e) {
        console.warn("[SHINEN] Script injection failed:", e);
      }

      const sourceUrl = extracted.canonicalUrl || url;
      const clipData = {
        url: sourceUrl,
        title,
        img: extracted.img || "",
        poster: extracted.poster || "",
        mediaKind: extracted.mk || "",
        embedUrl: extracted.embed || "",
        provider: extracted.provider || "",
        site: extracted.site || "",
        sel: extracted.sel || "",
        savedAt: Date.now(),
      };

      // Enqueue to chrome.storage.local (await ensures data persists before popup close)
      await enqueue(chrome.storage.local, clipData);

      statusEl.textContent = "Saved! Open SHINEN to see your card.";
      btn.textContent = "Saved \u2713";
      await updateQueueCount();

      // Also try to open SHINEN (if not already open)
      const shinenTabs = await chrome.tabs.query({ url: SHINEN_BASE + "*" });
      if (shinenTabs.length === 0) {
        // Build URL with params for immediate card creation
        const params = new URLSearchParams();
        params.set("auto", "1");
        params.set("url", sourceUrl.slice(0, 2000));
        params.set("title", title.slice(0, 200));
        if (extracted.img) params.set("img", extracted.img.slice(0, 2000));
        if (extracted.poster) params.set("poster", extracted.poster.slice(0, 2000));
        if (extracted.mk) params.set("mk", extracted.mk);
        if (extracted.embed) params.set("embed", extracted.embed.slice(0, 2000));
        if (extracted.provider) params.set("provider", extracted.provider);
        if (extracted.site) params.set("site", extracted.site.slice(0, 100));
        if (extracted.sel) params.set("s", extracted.sel.slice(0, 1200));
        await chrome.tabs.create({ url: `${SHINEN_BASE}?${params.toString()}` });
      }
      // If SHINEN is already open, the content bridge will pick up the queue change
    } catch (e) {
      console.error("[SHINEN] Save failed:", e);
      statusEl.textContent = "Error saving. Try again.";
      btn.disabled = false;
    }
  });
}

async function updateQueueCount() {
  const el = document.getElementById("queue-count");
  if (!el) return;
  const queue = await getQueue(chrome.storage.local);
  el.textContent = queue.length > 0 ? `${queue.length} pending` : "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Content extraction function (runs in page context).
 * Same logic as background.js extractPageData.
 */
function extractPageData() {
  function canonicalUrl(raw) {
    try {
      const p = new URL(raw);
      p.hash = "";
      const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "fbclid", "gclid"];
      for (const key of drop) p.searchParams.delete(key);
      return p.toString();
    } catch {
      return raw;
    }
  }

  function upgradeInstagram(raw) {
    if (!raw) return raw;
    let host = "";
    try {
      host = new URL(raw, location.href).hostname.toLowerCase();
    } catch {
      return raw;
    }
    if (!(host.includes("instagram.") || host.includes("cdninstagram.com") || host.includes("fbcdn.net"))) return raw;
    return raw.replace(/([/_])(p|s)(150|240|320|480|540|640|720|750)x\3(?=([/_\\.-]|$))/gi, "$1$21080x1080");
  }

  function norm(raw) {
    if (!raw) return null;
    let x = String(raw).replace(/&amp;/gi, "&").trim();
    if (!x) return null;
    if (x.includes("%2F") || x.includes("%3A")) {
      try {
        const decoded = decodeURIComponent(x);
        if (/^https?:\/\//.test(decoded) || /^\/\//.test(decoded)) x = decoded;
      } catch {
        // Ignore malformed escapes.
      }
    }
    if (x.startsWith("//")) x = "https:" + x;
    if (x.startsWith("/")) {
      try {
        x = new URL(x, location.href).href;
      } catch {
        return null;
      }
    }
    if (!/^https?:\/\//.test(x)) return null;
    return upgradeInstagram(x).slice(0, 2000);
  }

  function isUiAsset(src) {
    const low = String(src || "").toLowerCase();
    if (!low) return true;
    if (low.startsWith("data:")) return true;
    if (/\.svg(\?|$)/i.test(low)) return true;
    return /(favicon|sprite|emoji|icon|avatar|profile)/i.test(low);
  }

  function parseSrcsetMax(raw) {
    if (!raw) return null;
    let best = null;
    let bestW = 0;
    for (const entry of String(raw).split(",")) {
      const part = entry.trim();
      if (!part) continue;
      const bits = part.split(/\s+/).filter(Boolean);
      if (!bits.length) continue;
      const src = norm(bits[0]);
      if (!src || isUiAsset(src)) continue;
      const descriptor = bits[bits.length - 1] || "";
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
    for (const im of Array.from(document.images || [])) {
      const src = (im.currentSrc || im.src || im.getAttribute("data-src") || im.getAttribute("data-original") || "").trim();
      if (!src) continue;
      const n = norm(src);
      if (!n || isUiAsset(n)) continue;
      if (typeof matchFn === "function" && !matchFn(n, im)) continue;
      const w = Number(im.naturalWidth || im.width || 0);
      const h = Number(im.naturalHeight || im.height || 0);
      if (w < 200 || h < 200) continue;
      const area = w * h;
      if (!best || area > best.area) best = { src: n, area };
    }
    return best ? best.src : null;
  }

  function upgradeXOrig(raw) {
    const abs = norm(raw);
    if (!abs) return null;
    try {
      const p = new URL(abs);
      const host = p.hostname.toLowerCase();
      if (!host.includes("twimg.com")) return p.toString();
      p.pathname = p.pathname.replace(/:(small|medium|large|orig)$/i, ":orig");
      const name = (p.searchParams.get("name") || "").toLowerCase();
      if (!name || name === "small" || name === "medium" || name === "large" || name === "thumb") {
        p.searchParams.set("name", "orig");
      }
      return p.toString();
    } catch {
      return abs;
    }
  }

  function detectXEmbed(rawUrl) {
    try {
      const p = new URL(rawUrl);
      const host = p.hostname.toLowerCase();
      if (!(host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com"))) return null;
      const m = p.pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)/i);
      if (!m) return null;
      const tweetUrl = "https://x.com/" + m[1] + "/status/" + m[2];
      return "https://platform.twitter.com/embed/Tweet.html?dnt=1&url=" + encodeURIComponent(tweetUrl);
    } catch {
      return null;
    }
  }

  function detectInstagramEmbed(rawUrl) {
    try {
      const p = new URL(rawUrl);
      const host = p.hostname.toLowerCase();
      if (!(host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am")) return null;
      const m = p.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i);
      if (!m) return null;
      return "https://www.instagram.com/" + m[1].toLowerCase() + "/" + m[2] + "/embed/";
    } catch {
      return null;
    }
  }

  function extractPlatformMedia(sourceUrl) {
    const host = (location.hostname || "").toLowerCase();

    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
      const embed = detectXEmbed(sourceUrl);
      if (!embed) return null;
      let bestPoster = null;
      let bestArea = 0;
      for (const video of Array.from(document.querySelectorAll("video"))) {
        const poster = upgradeXOrig(video.poster || video.getAttribute("poster") || "");
        if (!poster) continue;
        const area = Number(video.videoWidth || video.width || 0) * Number(video.videoHeight || video.height || 0);
        if (!bestPoster || area >= bestArea) {
          bestPoster = poster;
          bestArea = area;
        }
      }
      let bestImage = pickLargestNatural((src) => {
        try {
          const p = new URL(src);
          return p.hostname.includes("pbs.twimg.com") && /\/media\//i.test(p.pathname);
        } catch {
          return false;
        }
      });
      if (bestImage) bestImage = upgradeXOrig(bestImage);
      if (bestPoster) return { mk: "embed", provider: "x", embed, poster: bestPoster, img: bestImage || bestPoster };
      if (bestImage) return { mk: "embed", provider: "x", embed, poster: bestImage, img: bestImage };
      return { mk: "embed", provider: "x", embed, poster: "", img: "" };
    }

    if (host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am") {
      let best = null;
      let bestW = 0;
      for (const image of Array.from(document.querySelectorAll("img[srcset]"))) {
        const candidate = parseSrcsetMax(image.getAttribute("srcset") || image.srcset || "");
        if (!candidate) continue;
        const width = Number(candidate.w || 1);
        if (!best || width > bestW) {
          best = candidate.src;
          bestW = width;
        }
      }
      if (!best) best = pickLargestNatural();
      best = upgradeInstagram(best || "");
      const embed = detectInstagramEmbed(sourceUrl);
      const isReel = /\/(reel|tv)\//i.test(location.pathname || "");
      if (isReel && embed) return { mk: "embed", provider: "instagram", embed, poster: best || "", img: best || "" };
      if (best) return { mk: "image", provider: "instagram", embed: "", poster: best, img: best };
      if (isReel && embed) return { mk: "embed", provider: "instagram", embed, poster: "", img: "" };
    }

    return null;
  }

  const sourceUrl = canonicalUrl(location.href);
  const siteMeta = document.querySelector('meta[property="og:site_name"]');
  const site = (siteMeta?.content || "").slice(0, 100);
  const sel = (window.getSelection()?.toString() || "").slice(0, 1200);
  const media = extractPlatformMedia(sourceUrl);

  const candidates = [];
  function add(v) {
    if (!v) return;
    if (typeof v === "string") candidates.push(v);
    else if (Array.isArray(v)) v.forEach(add);
    else if (v.url) candidates.push(v.url);
  }

  document.querySelectorAll(
    'meta[property="og:image"],meta[property="og:image:secure_url"],meta[property="og:image:url"],meta[name="twitter:image"],meta[property="twitter:image"]'
  ).forEach((m) => add(m.content));

  const lnk = document.querySelector('link[rel="image_src"]');
  if (lnk) add(lnk.href);

  document.querySelectorAll('script[type="application/ld+json"]').forEach((ld) => {
    try {
      const j = JSON.parse(ld.textContent || "{}");
      if (j["@graph"]) j["@graph"].forEach((g) => add(g.image || g.thumbnailUrl));
      else add(j.image || j.thumbnailUrl);
    } catch {
      // Ignore malformed JSON-LD.
    }
  });

  let img = media?.img || "";
  const host = (location.hostname || "").toLowerCase();
  const isXLikeHost = host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com");
  const isInstagramLikeHost = host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am";
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

  return {
    canonicalUrl: sourceUrl,
    site,
    img,
    poster: media?.poster || img || "",
    mk: media?.mk || "",
    embed: media?.embed || "",
    provider: media?.provider || "",
    sel,
  };
}

init();

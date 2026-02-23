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

      const clipData = {
        url,
        title,
        img: extracted.img || "",
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
        params.set("url", url.slice(0, 2000));
        params.set("title", title.slice(0, 200));
        if (extracted.img) params.set("img", extracted.img.slice(0, 2000));
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
  function norm(raw) {
    if (!raw) return null;
    let x = raw.trim();
    if (!x) return null;
    if (x.includes("%2F") || x.includes("%3A")) {
      try {
        const decoded = decodeURIComponent(x);
        if (/^https?:\/\//.test(decoded) || /^\/\//.test(decoded)) x = decoded;
      } catch (e) { /* ignore */ }
    }
    if (x.startsWith("//")) x = "https:" + x;
    if (x.startsWith("/")) {
      try { x = new URL(x, location.href).href; } catch (e) { return null; }
    }
    if (!/^https?:\/\//.test(x)) return null;
    return x.slice(0, 2000);
  }

  const siteMeta = document.querySelector('meta[property="og:site_name"]');
  const site = (siteMeta?.content || "").slice(0, 100);
  const sel = (window.getSelection()?.toString() || "").slice(0, 1200);

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
    } catch (e) { /* ignore */ }
  });

  let img = "";
  for (const c of candidates) {
    const n = norm(c);
    if (n) { img = n; break; }
  }

  return { site, img, sel };
}

init();

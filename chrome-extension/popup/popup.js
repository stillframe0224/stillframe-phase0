const SHINEN_URL_PATTERNS = [
  "*://stillframe-phase0.vercel.app/*",
  "*://localhost:3000/*",
  "*://127.0.0.1:3000/*",
  "*://localhost:4026/*",
  "*://127.0.0.1:4026/*",
];

const QUEUE_KEY = "shinen-clip-queue";

const state = {
  clipData: null,
  activeTabId: null,
};

const ui = {
  site: document.getElementById("site"),
  title: document.getElementById("title"),
  thumbWrap: document.getElementById("thumbWrap"),
  thumb: document.getElementById("thumb"),
  saveBtn: document.getElementById("saveBtn"),
  status: document.getElementById("status"),
};

init().catch((error) => {
  showStatus(`× ${toErrorMessage(error)}`, "error");
  ui.saveBtn.disabled = true;
});

async function init() {
  ui.saveBtn.addEventListener("click", onSave);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("アクティブタブを取得できませんでした");

  state.activeTabId = tab.id;
  const clipData = await captureClipData(tab.id);
  if (!clipData) throw new Error("データ取得失敗");

  state.clipData = clipData;
  renderPreview(clipData);
  ui.saveBtn.disabled = false;
}

async function onSave() {
  if (!state.clipData) {
    showStatus("× データ取得失敗", "error");
    return;
  }

  ui.saveBtn.disabled = true;

  try {
    const shinenTabs = await chrome.tabs.query({ url: SHINEN_URL_PATTERNS });

    if (shinenTabs.length > 0 && shinenTabs[0]?.id != null) {
      const tabId = shinenTabs[0].id;

      // Flush queued clips first.
      const queued = readQueuedClips();
      for (const queuedClip of queued) {
        await deliverToShinenTab(tabId, queuedClip);
      }
      clearQueuedClips();

      await deliverToShinenTab(tabId, state.clipData);
      showStatus("✓ Saved!", "ok");
      window.setTimeout(() => window.close(), 2000);
      return;
    }

    queueClip(state.clipData);
    showStatus("✓ Queued — open SHINEN to sync", "ok");
    window.setTimeout(() => window.close(), 2000);
  } catch (error) {
    ui.saveBtn.disabled = false;
    showStatus(`× ${toErrorMessage(error)}`, "error");
  }
}

async function captureClipData(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      function detectSite() {
        const host = window.location.hostname;
        if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
        if (host.includes("x.com") || host.includes("twitter.com")) return "x";
        if (host.includes("note.com")) return "note";
        if (host.includes("medium.com")) return "medium";
        if (host.includes("instagram.com")) return "instagram";
        return "generic";
      }

      function extractYouTube() {
        const url = window.location.href;
        const videoId =
          url.match(/[?&]v=([^&]+)/)?.[1] ||
          url.match(/youtu\.be\/([^?]+)/)?.[1] ||
          null;
        const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

        return {
          site: "youtube",
          title:
            document.querySelector('meta[property="og:title"]')?.content ||
            document.title.replace(/ - YouTube$/, ""),
          thumbnail,
          url,
          media: {
            type: "youtube",
            youtubeId: videoId,
            thumbnail,
          },
        };
      }

      function extractX() {
        const url = window.location.href;
        const username =
          url.match(/x\.com\/([^/]+)/)?.[1] ||
          url.match(/twitter\.com\/([^/]+)/)?.[1];

        return {
          site: "x",
          title: (document.querySelector('meta[property="og:description"]')?.content || "").slice(0, 100),
          thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
          url,
          author: username ? `@${username}` : null,
        };
      }

      function extractNote() {
        return {
          site: "note",
          title: document.querySelector('meta[property="og:title"]')?.content || document.title,
          thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
          url: window.location.href,
          author:
            document.querySelector('meta[name="author"]')?.content ||
            document.querySelector(".o-noteContentHeader__name")?.textContent ||
            null,
        };
      }

      function extractMedium() {
        return {
          site: "medium",
          title: document.querySelector('meta[property="og:title"]')?.content || document.title,
          thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
          url: window.location.href,
          author: document.querySelector('meta[name="author"]')?.content || null,
        };
      }

      function extractInstagram() {
        const url = window.location.href;
        const username = url.match(/instagram\.com\/([^/]+)/)?.[1];

        return {
          site: "instagram",
          title: (document.querySelector('meta[property="og:description"]')?.content || "").slice(0, 100),
          thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
          url,
          author: username ? `@${username}` : null,
        };
      }

      function extractGeneric() {
        const url = window.location.href;
        const domain = new URL(url).hostname;

        return {
          site: "other",
          title: document.querySelector('meta[property="og:title"]')?.content || document.title,
          thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
          url,
        };
      }

      const site = detectSite();
      switch (site) {
        case "youtube":
          return extractYouTube();
        case "x":
          return extractX();
        case "note":
          return extractNote();
        case "medium":
          return extractMedium();
        case "instagram":
          return extractInstagram();
        default:
          return extractGeneric();
      }
    },
  });

  return results[0]?.result || null;
}

async function deliverToShinenTab(tabId, clipData) {
  await sendRuntimeMessage(tabId, { type: "SHINEN_CLIP", data: clipData });

  await chrome.scripting.executeScript({
    target: { tabId },
    args: [clipData],
    func: (data) => {
      window.postMessage({ type: "SHINEN_CLIP", data }, "*");
    },
  });
}

function sendRuntimeMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, () => {
      resolve();
    });
  });
}

function renderPreview(data) {
  ui.site.textContent = data.site || "other";
  ui.title.textContent = data.title || data.url || "(no title)";

  if (data.thumbnail) {
    ui.thumb.src = data.thumbnail;
    ui.thumbWrap.hidden = false;
  } else {
    ui.thumb.removeAttribute("src");
    ui.thumbWrap.hidden = true;
  }
}

function showStatus(message, tone) {
  ui.status.hidden = false;
  ui.status.textContent = message;
  ui.status.className = `status ${tone}`;
}

function readQueuedClips() {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function clearQueuedClips() {
  localStorage.removeItem(QUEUE_KEY);
}

function queueClip(clipData) {
  const queue = readQueuedClips();
  queue.push({ ...clipData, timestamp: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function toErrorMessage(error) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "保存に失敗しました";
}

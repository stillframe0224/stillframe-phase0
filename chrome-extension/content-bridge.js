// Save to SHINEN — Content Bridge
// Injected into SHINEN domain pages via content_scripts.
// Drains the clip queue from chrome.storage.local and delivers items
// to the SHINEN app via window.postMessage. Listens for ACK replies.

const CHANNEL = "SAVE_TO_SHINEN_V1";
const QUEUE_KEY = "shinen_clip_queue";

// Pending ACKs: clipId -> nonce
const pendingAcks = new Map();

/** Read queue from chrome.storage.local */
async function getQueue() {
  const result = await chrome.storage.local.get(QUEUE_KEY);
  return Array.isArray(result[QUEUE_KEY]) ? result[QUEUE_KEY] : [];
}

/** Write queue to chrome.storage.local */
async function setQueue(queue) {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

/** Drain queue — post each item to the page */
async function drainQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return;

  for (const item of queue) {
    // Track pending ACK
    pendingAcks.set(item.clipId, item.nonce);

    // Post to page
    window.postMessage(
      {
        channel: CHANNEL,
        type: "SHINEN_CLIP",
        clipId: item.clipId,
        nonce: item.nonce,
        data: item.data,
        sentAt: Date.now(),
      },
      "*"
    );
  }
}

/** Handle ACK from SHINEN app */
async function handleAck(clipId, nonce) {
  const expectedNonce = pendingAcks.get(clipId);
  if (!expectedNonce) return; // Unknown clipId
  if (expectedNonce !== nonce) return; // Nonce mismatch — ignore

  // ACK matches — remove from queue
  pendingAcks.delete(clipId);

  const queue = await getQueue();
  const idx = queue.findIndex((item) => item.clipId === clipId && item.nonce === nonce);
  if (idx !== -1) {
    queue.splice(idx, 1);
    await setQueue(queue);
  }
}

// Listen for ACK messages from page
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.channel !== CHANNEL || msg.type !== "SHINEN_CLIP_ACK") return;
  handleAck(msg.clipId, msg.nonce);
});

// Listen for storage changes (new items added by popup)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[QUEUE_KEY]) {
    drainQueue();
  }
});

// Initial drain on load
drainQueue();

// Queue SSOT — chrome.storage.local backed queue for clip items
// Each item: { clipId: string, nonce: string, data: object, enqueuedAt: number }

const QUEUE_KEY = "shinen_clip_queue";
const MAX_QUEUE = 200;

/** Read queue from chrome.storage.local */
export async function getQueue(storage) {
  const result = await storage.get(QUEUE_KEY);
  return Array.isArray(result[QUEUE_KEY]) ? result[QUEUE_KEY] : [];
}

/** Write queue to chrome.storage.local */
export async function setQueue(storage, queue) {
  await storage.set({ [QUEUE_KEY]: queue });
}

/** Generate a random nonce */
export function generateNonce() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Generate a clip ID */
export function generateClipId() {
  return "clip_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/**
 * Enqueue a clip item. Enforces MAX_QUEUE limit (drops oldest).
 * Returns the enqueued item (with clipId and nonce).
 */
export async function enqueue(storage, data) {
  const queue = await getQueue(storage);
  const item = {
    clipId: generateClipId(),
    nonce: generateNonce(),
    data,
    enqueuedAt: Date.now(),
  };

  queue.push(item);

  // Drop oldest if over limit
  while (queue.length > MAX_QUEUE) {
    const dropped = queue.shift();
    console.warn("[SHINEN Queue] Dropped oldest item:", dropped?.clipId);
  }

  await setQueue(storage, queue);
  return item;
}

/**
 * Remove an item from queue only if clipId AND nonce match.
 * Returns true if removed, false if not found or nonce mismatch.
 */
export async function dequeueByAck(storage, clipId, nonce) {
  const queue = await getQueue(storage);
  const idx = queue.findIndex((item) => item.clipId === clipId);
  if (idx === -1) return false;
  if (queue[idx].nonce !== nonce) return false;
  queue.splice(idx, 1);
  await setQueue(storage, queue);
  return true;
}

/**
 * Migrate items from popup localStorage format to chrome.storage.local.
 * Only runs once (sets migration flag).
 */
export async function migrateFromLocalStorage(storage) {
  const result = await storage.get("shinen_queue_migrated");
  if (result.shinen_queue_migrated) return;

  // Try to read from localStorage (only works in popup context)
  if (typeof localStorage === "undefined") {
    await storage.set({ shinen_queue_migrated: true });
    return;
  }

  try {
    const LEGACY_KEYS = ["shinen_clip_queue", "shinen-clip-queue"];
    const allMigrated = [];

    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const oldItems = JSON.parse(raw);
        if (Array.isArray(oldItems)) {
          for (const item of oldItems) {
            allMigrated.push({
              clipId: item.clipId || generateClipId(),
              nonce: item.nonce || generateNonce(),
              data: item.data || item,
              enqueuedAt: item.enqueuedAt || Date.now(),
            });
          }
        }
      } catch (parseErr) {
        console.warn(`[SHINEN Queue] Failed to parse "${key}":`, parseErr);
      }
      localStorage.removeItem(key);
    }

    if (allMigrated.length > 0) {
      // Deduplicate by clipId
      const seen = new Set();
      const unique = allMigrated.filter((item) => {
        if (seen.has(item.clipId)) return false;
        seen.add(item.clipId);
        return true;
      });
      const existing = await getQueue(storage);
      const merged = [...existing, ...unique].slice(-MAX_QUEUE);
      await setQueue(storage, merged);
    }
  } catch (e) {
    console.warn("[SHINEN Queue] Migration error:", e);
  }

  await storage.set({ shinen_queue_migrated: true });
}

// For testing
export { QUEUE_KEY, MAX_QUEUE };

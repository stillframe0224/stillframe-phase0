/**
 * clip-receiver.ts — Receives clips from the Chrome extension content bridge.
 *
 * Protocol (SAVE_TO_SHINEN_V1):
 *   SHINEN_CLIP: { channel, type, clipId, nonce, data, sentAt }
 *   SHINEN_CLIP_ACK: { channel, type, clipId, nonce, receivedAt }
 *
 * Usage:
 *   import { initClipReceiver, destroyClipReceiver } from "./lib/clip-receiver";
 *   useEffect(() => {
 *     const cleanup = initClipReceiver((clipData) => { addCard(clipData); });
 *     return cleanup;
 *   }, []);
 */

const CHANNEL = "SAVE_TO_SHINEN_V1";

export interface ClipData {
  url: string;
  title: string;
  img?: string;
  site?: string;
  sel?: string;
  savedAt?: number;
}

// Dedup: track seen clipIds to avoid processing the same clip twice
const seenClipIds = new Set<string>();

type ClipHandler = (data: ClipData) => void;

let currentHandler: ClipHandler | null = null;
let currentListener: ((event: MessageEvent) => void) | null = null;

/**
 * Initialize the clip receiver. Returns a cleanup function.
 * @param onClip - Called with clip data when a new clip arrives.
 */
export function initClipReceiver(onClip: ClipHandler): () => void {
  currentHandler = onClip;

  const listener = (event: MessageEvent) => {
    // Only accept messages from our own window
    if (event.source !== window) return;

    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL || msg.type !== "SHINEN_CLIP") return;

    const { clipId, nonce, data } = msg;

    // Always ACK (even for duplicates) to help queue drain
    sendAck(clipId, nonce);

    // Dedup check
    if (seenClipIds.has(clipId)) return;
    seenClipIds.add(clipId);

    // Cap seen set size
    if (seenClipIds.size > 500) {
      const first = seenClipIds.values().next().value;
      if (first !== undefined) seenClipIds.delete(first);
    }

    // Process clip
    if (currentHandler && data) {
      try {
        currentHandler(data);
      } catch (e) {
        console.error("[SHINEN clip-receiver] Handler error:", e);
        // Don't ACK on failure? We already ACK'd above for queue drain.
        // The dedup prevents re-processing anyway.
      }
    }
  };

  currentListener = listener;
  window.addEventListener("message", listener);

  return () => {
    window.removeEventListener("message", listener);
    if (currentListener === listener) {
      currentListener = null;
      currentHandler = null;
    }
  };
}

function sendAck(clipId: string, nonce: string) {
  window.postMessage(
    {
      channel: CHANNEL,
      type: "SHINEN_CLIP_ACK",
      clipId,
      nonce,
      receivedAt: Date.now(),
    },
    "*",
  );
}

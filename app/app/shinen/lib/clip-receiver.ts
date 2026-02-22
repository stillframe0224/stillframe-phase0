export interface ClipData {
  site: string;
  title: string;
  thumbnail?: string | null;
  url: string;
  author?: string | null;
  favicon?: string | null;
  media?: {
    type: string;
    youtubeId?: string;
    thumbnail?: string;
  };
}

export function setupClipReceiver(onClip: (data: ClipData) => void) {
  const runtime = (globalThis as { chrome?: { runtime?: any } }).chrome?.runtime;

  const runtimeListener = (message: { type?: string; data?: ClipData }) => {
    if (message?.type === "SHINEN_CLIP" && message.data) {
      onClip(message.data);
    }
  };

  if (runtime?.onMessage?.addListener) {
    runtime.onMessage.addListener(runtimeListener);
  }

  const windowListener = (event: MessageEvent) => {
    if (event.data?.type === "SHINEN_CLIP" && event.data.data) {
      onClip(event.data.data as ClipData);
    }
  };
  window.addEventListener("message", windowListener);

  try {
    const queue = JSON.parse(localStorage.getItem("shinen-clip-queue") || "[]");
    if (Array.isArray(queue) && queue.length > 0) {
      queue.forEach((data: ClipData) => onClip(data));
      localStorage.removeItem("shinen-clip-queue");
    }
  } catch {
    // no-op
  }

  return () => {
    window.removeEventListener("message", windowListener);
    runtime?.onMessage?.removeListener?.(runtimeListener);
  };
}

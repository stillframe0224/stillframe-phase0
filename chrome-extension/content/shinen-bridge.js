(() => {
  const KEY = "shinen-clip-queue";

  function toClipArray(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => item && typeof item === "object");
  }

  function queueInPageStorage(data) {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
      const queue = toClipArray(parsed);
      queue.push(data);
      localStorage.setItem(KEY, JSON.stringify(queue));
    } catch {
      // no-op
    }
  }

  function dispatchClip(data) {
    queueInPageStorage(data);
    window.postMessage({ type: "SHINEN_CLIP", data }, "*");
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "SHINEN_CLIP") return;
    dispatchClip(message.data);
  });
})();

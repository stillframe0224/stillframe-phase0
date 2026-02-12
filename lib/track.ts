export function track(event: string, props?: Record<string, string>) {
  const payload = JSON.stringify({
    event,
    ts: new Date().toISOString(),
    props: props || {},
    url: typeof window !== "undefined" ? window.location.pathname : "/",
  });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", payload);
  } else if (typeof fetch !== "undefined") {
    fetch("/api/track", { method: "POST", body: payload, keepalive: true });
  }
}

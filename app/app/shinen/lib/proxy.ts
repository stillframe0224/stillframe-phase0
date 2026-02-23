/**
 * toProxySrc — rewrite external image URLs through /api/image-proxy.
 *
 * Rules:
 *   - Already proxied (/api/image-proxy)    → return as-is
 *   - data: or blob:                         → return as-is
 *   - Same-origin (starts with "/" or origin) → return as-is
 *   - http:// (not https)                    → return as-is (proxy rejects anyway)
 *   - External https://                      → proxy
 */
export function toProxySrc(src: string | undefined | null): string {
  if (!src) return "";

  // Already proxied or local
  if (
    src.startsWith("/api/image-proxy") ||
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("/")
  ) {
    return src;
  }

  // Same-origin absolute URL (server-side safe)
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return src; // http/file/etc — skip
    if (typeof window !== "undefined" && url.origin === window.location.origin) {
      return src;
    }
  } catch {
    return src; // unparseable — return as-is
  }

  return `/api/image-proxy?url=${encodeURIComponent(src)}`;
}

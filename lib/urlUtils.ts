const HTTP_URL_RE = /https?:\/\/[^\s<>"')\]]+/i;

/** Extract the first http/https URL from text, trimming trailing punctuation. */
export function extractFirstHttpUrl(text: string): string | null {
  const match = text.match(HTTP_URL_RE);
  if (!match) return null;
  return match[0].replace(/[.,;:!?)]+$/, "");
}

/**
 * Extract YouTube video ID from various URL formats.
 * Supports: watch?v=, youtu.be/, shorts/, live/, embed/, with params
 */
function extractYouTubeVideoId(url: string): string | null {
  // Normalize URL: decode once if encoded, trim whitespace
  let normalized = url.trim();
  if (normalized.includes("%2F") || normalized.includes("%3A")) {
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Malformed encoding, continue with original
    }
  }

  // Pattern 1: youtu.be/<id>
  const shortMatch = normalized.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // Pattern 2: youtube.com/watch?v=<id>
  const watchMatch = normalized.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // Pattern 3: youtube.com/shorts/<id>
  const shortsMatch = normalized.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  // Pattern 4: youtube.com/live/<id>
  const liveMatch = normalized.match(/youtube\.com\/live\/([A-Za-z0-9_-]{11})/);
  if (liveMatch) return liveMatch[1];

  // Pattern 5: youtube.com/embed/<id>
  const embedMatch = normalized.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // Pattern 6: youtube.com/v/<id>
  const vMatch = normalized.match(/youtube\.com\/v\/([A-Za-z0-9_-]{11})/);
  if (vMatch) return vMatch[1];

  return null;
}

/** For YouTube URLs, return the thumbnail; null otherwise. */
export function getYouTubeThumbnail(
  url: string,
  quality: "maxres" | "sd" | "hq" | "mq" | "default" = "hq"
): string | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  // Debug log in development
  if (typeof window !== "undefined" && localStorage.getItem("SHINEN_DEBUG_PREVIEW") === "1") {
    console.log("[youtube] extracted videoId:", videoId, "quality:", quality, "from:", url);
  }

  const qualityMap = {
    maxres: "maxresdefault", // 1920x1080 (not always available)
    sd: "sddefault",         // 640x480
    hq: "hqdefault",         // 480x360
    mq: "mqdefault",         // 320x180
    default: "default",      // 120x90 (always available)
  };

  return `https://i.ytimg.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

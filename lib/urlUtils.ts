const HTTP_URL_RE = /https?:\/\/[^\s<>"')\]]+/i;
const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

/** Extract the first http/https URL from text, trimming trailing punctuation. */
export function extractFirstHttpUrl(text: string): string | null {
  const match = text.match(HTTP_URL_RE);
  if (!match) return null;
  return match[0].replace(/[.,;:!?)]+$/, "");
}

/** For YouTube URLs, return the hqdefault thumbnail; null otherwise. */
export function getYouTubeThumbnail(url: string): string | null {
  const match = url.match(YT_RE);
  return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : null;
}

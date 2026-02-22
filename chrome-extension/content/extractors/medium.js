export function extractMedium() {
  return {
    site: "medium",
    title: document.querySelector('meta[property="og:title"]')?.content || document.title,
    thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
    url: window.location.href,
    author: document.querySelector('meta[name="author"]')?.content || null,
  };
}

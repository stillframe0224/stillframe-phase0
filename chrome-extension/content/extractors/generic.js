export function extractGeneric() {
  const url = window.location.href;
  const domain = new URL(url).hostname;

  return {
    site: "other",
    title: document.querySelector('meta[property="og:title"]')?.content || document.title,
    thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
    favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
    url,
  };
}

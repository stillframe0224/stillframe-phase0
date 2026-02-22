export function extractNote() {
  return {
    site: "note",
    title: document.querySelector('meta[property="og:title"]')?.content || document.title,
    thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
    url: window.location.href,
    author:
      document.querySelector('meta[name="author"]')?.content ||
      document.querySelector(".o-noteContentHeader__name")?.textContent ||
      null,
  };
}

export function extractX() {
  const url = window.location.href;
  const username = url.match(/x\.com\/([^/]+)/)?.[1] || url.match(/twitter\.com\/([^/]+)/)?.[1];

  return {
    site: "x",
    title: (document.querySelector('meta[property="og:description"]')?.content || "").slice(0, 100),
    thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
    url,
    author: username ? `@${username}` : null,
  };
}

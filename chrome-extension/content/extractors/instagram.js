export function extractInstagram() {
  const url = window.location.href;
  const username = url.match(/instagram\.com\/([^/]+)/)?.[1];

  return {
    site: "instagram",
    title: (document.querySelector('meta[property="og:description"]')?.content || "").slice(0, 100),
    thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
    url,
    author: username ? `@${username}` : null,
  };
}

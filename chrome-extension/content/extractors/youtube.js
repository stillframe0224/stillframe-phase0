export function extractYouTube() {
  const url = window.location.href;
  const videoId = url.match(/[?&]v=([^&]+)/)?.[1] || url.match(/youtu\.be\/([^?]+)/)?.[1] || null;
  const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  return {
    site: "youtube",
    title:
      document.querySelector('meta[property="og:title"]')?.content ||
      document.title.replace(/ - YouTube$/, ""),
    thumbnail,
    url,
    media: {
      type: "youtube",
      youtubeId: videoId,
      thumbnail,
    },
  };
}

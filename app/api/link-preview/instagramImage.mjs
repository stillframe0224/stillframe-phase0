function isInstagramLikeHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return (
    h === "instagram.com" ||
    h.endsWith(".instagram.com") ||
    h === "instagr.am" ||
    h.endsWith(".cdninstagram.com") ||
    h.endsWith(".fbcdn.net")
  );
}

function isLikelyIconUrl(src) {
  const low = src.toLowerCase();
  if (low.startsWith("data:")) return true;
  if (/\.svg(?:\?|$)/i.test(low)) return true;
  return /(favicon|sprite|emoji|icon|avatar|profile)/i.test(low);
}

export function upgradeInstagramUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (!isInstagramLikeHost(parsed.hostname)) return rawUrl;

  let next = parsed.toString();
  const before = next;

  next = next.replace(
    /([/_])(p|s)(150|240|320|480|540|640|720|750)x\3(?=([/_\-.&]|$))/gi,
    (_m, prefix, type) => `${prefix}${type}1080x1080`,
  );

  const maybe = new URL(next);
  const width = Number(maybe.searchParams.get("width") || "0");
  const height = Number(maybe.searchParams.get("height") || "0");
  if (width > 0 && width < 1080) maybe.searchParams.set("width", "1080");
  if (height > 0 && height < 1080) maybe.searchParams.set("height", "1080");
  next = maybe.toString();

  return next || before;
}

export function pickLargestInstagramImageCandidate(images) {
  if (!Array.isArray(images)) return null;
  let best = null;
  for (const image of images) {
    if (!image || typeof image !== "object") continue;
    const src = String(image.currentSrc || image.src || "").trim();
    if (!src || isLikelyIconUrl(src)) continue;
    const width = Number(image.naturalWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.height || 0);
    if (width < 200 || height < 200) continue;
    const area = width * height;
    if (!best || area > best.area) {
      best = { src, area };
    }
  }
  return best ? upgradeInstagramUrl(best.src) : null;
}

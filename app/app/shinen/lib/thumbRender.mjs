function normalizeHost(input) {
  if (!input) return "";
  try {
    if (/^https?:\/\//i.test(input)) return new URL(input).hostname.toLowerCase();
  } catch {
    return "";
  }
  return String(input).toLowerCase();
}

function isAmazonLikeHost(host) {
  return host.includes("amazon.") || host.includes("amzn.") || host === "a.co";
}

function isDmmLikeHost(host) {
  return host === "dmm.co.jp" || host.endsWith(".dmm.co.jp") || host === "fanza.dmm.co.jp";
}

export function getThumbRenderMode(domainOrUrl) {
  const host = normalizeHost(domainOrUrl);
  if (!host) return "cover";
  if (isAmazonLikeHost(host) || isDmmLikeHost(host)) return "contain_blur";
  return "cover";
}

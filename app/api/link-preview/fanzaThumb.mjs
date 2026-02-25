const FANZA_DMM_IMAGE_CANDIDATE_BUILDERS = [
  (cid) => `https://pics.dmm.co.jp/digital/video/${cid}/${cid}pl.jpg`,
  (cid) => `https://pics.dmm.co.jp/digital/video/${cid}/${cid}ps.jpg`,
  (cid) => `https://pics.dmm.co.jp/digital/book/${cid}/${cid}pl.jpg`,
  (cid) => `https://pics.dmm.co.jp/digital/comic/${cid}/${cid}pl.jpg`,
];

const AGE_GATE_PATTERNS = [
  /age[_-]?check/i,
  /年齢認証/u,
  /年齢確認/u,
  /18歳以上/u,
  /18才以上/u,
  /adult/i,
];

const DMM_SHARED_IMAGE_PATTERNS = [
  /age[_-]?check/i,
  /adult-check/i,
  /\/common\//i,
  /\/ogp\/(?:default|common)/i,
];

function normalizeCid(cid) {
  if (!cid) return null;
  const decoded = decodeURIComponent(String(cid).trim());
  const clean = decoded.replace(/[^a-zA-Z0-9_-]/g, "");
  return clean || null;
}

export function isDmmLikeHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "dmm.co.jp" || host.endsWith(".dmm.co.jp");
}

export function isAgeGateHtml(html, finalUrl = "") {
  const source = `${String(html || "")}\n${String(finalUrl || "")}`;
  return AGE_GATE_PATTERNS.some((pattern) => pattern.test(source));
}

export function isLikelySharedDmmImage(imageUrl) {
  if (!imageUrl) return false;
  const lower = String(imageUrl).toLowerCase();
  return DMM_SHARED_IMAGE_PATTERNS.some((pattern) => pattern.test(lower));
}

export function extractCid(rawUrl) {
  if (!rawUrl) return null;
  const text = String(rawUrl);
  try {
    const parsed = new URL(text);
    const queryCid = normalizeCid(parsed.searchParams.get("cid"));
    if (queryCid) return queryCid;
  } catch {
    // Fall through to regex path parse.
  }

  const matches = [
    text.match(/[?&]cid=([a-zA-Z0-9_%.-]+)/i)?.[1] ?? null,
    text.match(/\/cid=([a-zA-Z0-9_%.-]+)/i)?.[1] ?? null,
  ];
  for (const candidate of matches) {
    const cid = normalizeCid(candidate);
    if (cid) return cid;
  }
  return null;
}

export function inferDmmCoverCandidates(cid) {
  const cleanCid = normalizeCid(cid);
  if (!cleanCid) return [];
  return FANZA_DMM_IMAGE_CANDIDATE_BUILDERS.map((build) => build(cleanCid));
}

export async function headOk(url, fetchImpl = fetch) {
  if (!url) return false;
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-0",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(2500),
      redirect: "follow",
    });
    if (!(res.status === 200 || res.status === 206)) return false;
    const contentType = res.headers.get("content-type") || "";
    return !contentType || contentType.startsWith("image/");
  } catch {
    return false;
  }
}

export async function chooseCoverByProbe(cid, probe = headOk) {
  const candidates = inferDmmCoverCandidates(cid);
  for (const candidate of candidates) {
    try {
      if (await probe(candidate)) {
        return candidate;
      }
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

#!/usr/bin/env node
// Link preview smoke test — security & behavior checks, zero secrets
const BASE = "https://stillframe-phase0.vercel.app";
const results = [];
let failed = false;

function assert(label, condition, detail = "") {
  const pass = !!condition;
  if (!pass) failed = true;
  results.push({ label, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

// Exponential-backoff retry for network errors and 5xx/429 responses.
// Retry targets: ECONNRESET, ETIMEDOUT, "fetch failed", 5xx, 429.
// Max 3 attempts: delays 250ms → 750ms → 1500ms.
// Respects Retry-After header for 429.
async function fetchWithRetry(url, options = {}, maxAttempts = 3) {
  const DELAYS = [250, 750, 1500];
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = DELAYS[attempt - 1] ?? 1500;
      console.log(`  [retry] attempt ${attempt + 1}/${maxAttempts} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
      // 429: respect Retry-After, then retry
      if (res.status === 429 && attempt < maxAttempts - 1) {
        const retryAfterRaw = res.headers.get("retry-after");
        const retryAfterMs = retryAfterRaw
          ? Number.isFinite(Number(retryAfterRaw))
            ? Math.min(Number(retryAfterRaw) * 1000, 5000)
            : 1500
          : 1500;
        console.log(`  [retry] 429 received, waiting ${retryAfterMs}ms`);
        await new Promise((r) => setTimeout(r, retryAfterMs));
        lastError = new Error(`HTTP 429`);
        continue;
      }
      // 5xx: retry
      if (res.status >= 500 && attempt < maxAttempts - 1) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      // Only retry on network-level errors
      const msg = e?.message ?? "";
      const isNetworkErr =
        msg.includes("fetch failed") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("network") ||
        e?.name === "TimeoutError";
      if (!isNetworkErr || attempt >= maxAttempts - 1) throw e;
    }
  }
  throw lastError ?? new Error("max retries exceeded");
}

async function fetchJSON(path) {
  const res = await fetchWithRetry(`${BASE}${path}`);
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  console.log("=== Link Preview Smoke Test ===\n");

  // 1) SSRF blocks
  const ssrfTargets = [
    ["SSRF block: 127.0.0.1", "http://127.0.0.1"],
    ["SSRF block: 169.254.169.254", "http://169.254.169.254"],
  ];
  for (const [label, url] of ssrfTargets) {
    try {
      const { status, body } = await fetchJSON(
        `/api/link-preview?url=${encodeURIComponent(url)}`
      );
      assert(label, status === 400 && body.error === "blocked_url",
        `status=${status} error=${body.error || "(none)"}`);
    } catch (e) {
      assert(label, false, `fetch error: ${e.message}`);
    }
  }

  // 2) YouTube shortcut — no HTML fetch, returns thumbnail directly
  try {
    const ytUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const { status, body } = await fetchJSON(
      `/api/link-preview?url=${encodeURIComponent(ytUrl)}`
    );
    assert("YouTube shortcut",
      status === 200 &&
      typeof body.image === "string" &&
      body.image.includes("i.ytimg.com/vi/dQw4w9WgXcQ"),
      `status=${status} image=${body.image || "(null)"}`);
  } catch (e) {
    assert("YouTube shortcut", false, `fetch error: ${e.message}`);
  }

  // 2b) YouTube video NpDNSAPtGrw — must return i.ytimg.com maxresdefault thumbnail, NOT yt_1200.png logo
  try {
    const ytUrl = "https://www.youtube.com/watch?v=NpDNSAPtGrw";
    const { status, body } = await fetchJSON(
      `/api/link-preview?url=${encodeURIComponent(ytUrl)}`
    );
    const isValidThumb =
      body.image &&
      body.image.includes("i.ytimg.com/vi/NpDNSAPtGrw") &&
      body.image.includes("maxresdefault.jpg") &&
      !body.image.includes("yt_1200.png");
    assert("YouTube NpDNSAPtGrw (maxres, no logo fallback)",
      status === 200 && isValidThumb,
      `status=${status} image=${body.image || "(null)"}`);
  } catch (e) {
    assert("YouTube NpDNSAPtGrw (maxres, no logo fallback)", false, `fetch error: ${e.message}`);
  }

  // 2c) YouTube Shorts 2Z4m4lnjxkY — API returns maxresdefault; client onError handles 404 fallback
  try {
    const ytUrl = "https://www.youtube.com/shorts/2Z4m4lnjxkY";
    const { status, body } = await fetchJSON(
      `/api/link-preview?url=${encodeURIComponent(ytUrl)}`
    );
    const isValidThumb =
      body.image &&
      body.image.includes("i.ytimg.com/vi/2Z4m4lnjxkY") &&
      body.image.includes("maxresdefault.jpg");
    assert("YouTube Shorts 2Z4m4lnjxkY (maxres from API)",
      status === 200 && isValidThumb,
      `status=${status} image=${body.image || "(null)"}`);
  } catch (e) {
    assert("YouTube Shorts 2Z4m4lnjxkY (maxres from API)", false, `fetch error: ${e.message}`);
  }

  // 2d) Instagram post — oEmbed+jina path; accept image or null (IG may block server fetches).
  try {
    const igUrl = "https://www.instagram.com/p/CUlRMQkM0Gi/";
    const { status, body } = await fetchJSON(
      `/api/link-preview?url=${encodeURIComponent(igUrl)}`
    );
    // Accept 200 with either an image URL or null (IG may block server-side fetches)
    const isValidResponse = status === 200 && typeof body === "object";
    const hasImageOrNull = body.image === null || (typeof body.image === "string" && body.image.startsWith("https://"));
    assert("Instagram oEmbed returns 200 (image or null)",
      isValidResponse && hasImageOrNull,
      `status=${status} image=${body.image || "(null)"}`);
    // If image is present, it must be an https:// URL (not an HTML error page)
    if (body.image) {
      assert("Instagram image is https:// URL",
        body.image.startsWith("https://"),
        `image=${body.image.slice(0, 60)}`);
    }
  } catch (e) {
    assert("Instagram oEmbed returns 200 (image or null)", false, `fetch error: ${e.message}`);
  }

  // 2e) Instagram scheme-less URL normalization — must not 400
  // Verifies normalizeInstagramUrl() handles bare hostname before URL parsing.
  // Only runs against localhost (where this branch's code is active).
  if (BASE.includes("localhost") || BASE.includes("127.0.0.1")) {
    try {
      const schemelesIgUrl = "instagram.com/p/CUlRMQkM0Gi/";
      const { status, body } = await fetchJSON(
        `/api/link-preview?url=${encodeURIComponent(schemelesIgUrl)}`
      );
      const notBlocked = status === 200 && typeof body === "object" && !body.error;
      assert("Instagram scheme-less URL normalized (no 400)",
        notBlocked,
        `status=${status} error=${body?.error || "(none)"}`);
    } catch (e) {
      assert("Instagram scheme-less URL normalized (no 400)", false, `fetch error: ${e.message}`);
    }
  }

  // 3) Normal external fetch — should return image or favicon
  try {
    const { status, body } = await fetchJSON(
      `/api/link-preview?url=${encodeURIComponent("https://github.com")}`
    );
    const hasAsset =
      (typeof body.image === "string" && body.image.startsWith("https://")) ||
      (typeof body.favicon === "string" && body.favicon.startsWith("https://"));
    assert("External fetch (github.com)",
      status === 200 && hasAsset,
      `status=${status} image=${body.image || "(null)"} favicon=${body.favicon || "(null)"}`);
  } catch (e) {
    assert("External fetch (github.com)", false, `fetch error: ${e.message}`);
  }

  // ── image-proxy tests ──

  // 4) SSRF blocks on image-proxy
  // http:// URLs are rejected by the https-only check (https_only) before SSRF guard.
  // https:// private-IP URLs are rejected by SSRF guard (blocked_url).
  // Either way: status must be 400.
  const proxySSRF = [
    ["image-proxy SSRF block: 127.0.0.1", "http://127.0.0.1/img.png"],
    ["image-proxy SSRF block: 169.254.169.254", "http://169.254.169.254/latest/meta-data/"],
  ];
  for (const [label, url] of proxySSRF) {
    try {
      const { status, body } = await fetchJSON(
        `/api/image-proxy?url=${encodeURIComponent(url)}`
      );
      // Accept blocked_url (SSRF) or https_only — both mean the request was correctly rejected.
      const isBlocked = status === 400 && (body.error === "blocked_url" || body.error === "https_only");
      assert(label, isBlocked,
        `status=${status} error=${body.error || "(none)"}`);
    } catch (e) {
      assert(label, false, `fetch error: ${e.message}`);
    }
  }

  // 5) image-proxy returns a valid image
  try {
    const imgUrl = "https://github.githubassets.com/favicons/favicon.svg";
    const res = await fetchWithRetry(
      `${BASE}/api/image-proxy?url=${encodeURIComponent(imgUrl)}`
    );
    const ct = res.headers.get("content-type") || "";
    assert("image-proxy returns image",
      res.status === 200 && ct.startsWith("image/"),
      `status=${res.status} content-type=${ct}`);
  } catch (e) {
    assert("image-proxy returns image", false, `fetch error: ${e.message}`);
  }

  // 6) image-proxy rejects missing url param
  try {
    const { status, body } = await fetchJSON("/api/image-proxy");
    assert("image-proxy rejects missing url",
      status === 400 && body.error === "url required",
      `status=${status} error=${body.error || "(none)"}`);
  } catch (e) {
    assert("image-proxy rejects missing url", false, `fetch error: ${e.message}`);
  }

  // 7) image-proxy does NOT SSRF-block IG CDN domains (*.cdninstagram.com / *.fbcdn.net)
  // These are public CDN hosts — proxy should pass SSRF guard (may return 502 if no real image,
  // but must NOT return 400 blocked_url).
  try {
    const igCdnUrl = "https://scontent.cdninstagram.com/test.jpg";
    const res = await fetchWithRetry(
      `${BASE}/api/image-proxy?url=${encodeURIComponent(igCdnUrl)}`
    );
    // 400 blocked_url = SSRF block (wrong). 502 = CDN returned error (expected for fake path).
    const notBlocked = res.status !== 400;
    assert("image-proxy allows IG CDN host (not SSRF blocked)",
      notBlocked,
      `status=${res.status} (expect 502 or 200, not 400)`);
  } catch (e) {
    assert("image-proxy allows IG CDN host (not SSRF blocked)", false, `fetch error: ${e.message}`);
  }

  // Summary
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== RESULT: ${failed ? "FAIL" : "PASS"} (${passed}/${results.length}) ===`);
  process.exit(failed ? 1 : 0);
}

main();

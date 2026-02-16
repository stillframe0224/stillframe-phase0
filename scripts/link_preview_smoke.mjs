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

async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`);
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

  // 2b) YouTube video NpDNSAPtGrw — must return i.ytimg.com thumbnail, NOT yt_1200.png logo
  try {
    const ytUrl = "https://www.youtube.com/watch?v=NpDNSAPtGrw";
    const { status, body } = await fetchJSON(
      `/api/link-preview?url=${encodeURIComponent(ytUrl)}`
    );
    const isValidThumb =
      body.image &&
      body.image.includes("i.ytimg.com/vi/NpDNSAPtGrw") &&
      body.image.includes("hqdefault.jpg") &&
      !body.image.includes("yt_1200.png");
    assert("YouTube NpDNSAPtGrw (no logo fallback)",
      status === 200 && isValidThumb,
      `status=${status} image=${body.image || "(null)"}`);
  } catch (e) {
    assert("YouTube NpDNSAPtGrw (no logo fallback)", false, `fetch error: ${e.message}`);
  }

  // 2c) YouTube Shorts 2Z4m4lnjxkY — must return hqdefault, NOT maxresdefault (which returns placeholder)
  try {
    const ytUrl = "https://www.youtube.com/shorts/2Z4m4lnjxkY";
    const { status, body } = await fetchJSON(
      `/api/link-preview?url=${encodeURIComponent(ytUrl)}`
    );
    const isValidThumb =
      body.image &&
      body.image.includes("i.ytimg.com/vi/2Z4m4lnjxkY") &&
      body.image.includes("hqdefault.jpg") &&
      !body.image.includes("maxresdefault");
    assert("YouTube Shorts 2Z4m4lnjxkY (hq not maxres)",
      status === 200 && isValidThumb,
      `status=${status} image=${body.image || "(null)"}`);
  } catch (e) {
    assert("YouTube Shorts 2Z4m4lnjxkY (hq not maxres)", false, `fetch error: ${e.message}`);
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
  const proxySSRF = [
    ["image-proxy SSRF block: 127.0.0.1", "http://127.0.0.1/img.png"],
    ["image-proxy SSRF block: 169.254.169.254", "http://169.254.169.254/latest/meta-data/"],
  ];
  for (const [label, url] of proxySSRF) {
    try {
      const { status, body } = await fetchJSON(
        `/api/image-proxy?url=${encodeURIComponent(url)}`
      );
      assert(label, status === 400 && body.error === "blocked_url",
        `status=${status} error=${body.error || "(none)"}`);
    } catch (e) {
      assert(label, false, `fetch error: ${e.message}`);
    }
  }

  // 5) image-proxy returns a valid image
  try {
    const imgUrl = "https://github.githubassets.com/favicons/favicon.svg";
    const res = await fetch(
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

  // Summary
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== RESULT: ${failed ? "FAIL" : "PASS"} (${passed}/${results.length}) ===`);
  process.exit(failed ? 1 : 0);
}

main();

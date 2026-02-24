import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { pickBestImageFromHtml } from "../../app/api/link-preview/imageExtract.mjs";
import { buildAmazonImageHeaders, isAmazonCdnHost } from "../../app/api/image-proxy/amazonHeaders.mjs";
import { createDiagStore, isDebugModeEnabled } from "../../app/app/shinen/lib/diag.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("ThoughtCard open link anchor keeps target/rel hardening", () => {
  const thoughtCardPath = path.resolve(__dirname, "../../app/app/shinen/ThoughtCard.tsx");
  const src = fs.readFileSync(thoughtCardPath, "utf8");
  const split = src.split('data-testid="card-open-link"');
  assert.ok(split.length > 1, "card-open-link test id not found");
  const local = split[1].slice(0, 4000);
  assert.match(local, /target="_blank"/);
  assert.match(local, /rel="noopener noreferrer"/);
  assert.match(local, /onClickCapture/);
  assert.match(src, /↗ open/);
  assert.match(src, /type:\s*"open_click"/);
  assert.match(src, /type:\s*"thumb_error"/);
});

test("Amazon extraction prefers landingImage data-old-hires", () => {
  const html = `
    <html><head></head><body>
      <img id="landingImage" data-old-hires=" https://m.media-amazon.com/images/I/abc123._SL1500_.jpg?foo=1&amp;bar=2 " />
    </body></html>
  `;
  const image = pickBestImageFromHtml(html, "https://www.amazon.co.jp", "www.amazon.co.jp");
  assert.equal(image, "https://m.media-amazon.com/images/I/abc123._SL1500_.jpg?foo=1&bar=2");
});

test("Amazon extraction picks largest data-a-dynamic-image candidate", () => {
  const html = `
    <html><head></head><body>
      <img data-a-dynamic-image='{"https://m.media-amazon.com/images/I/small.jpg":[120,120],"https://m.media-amazon.com/images/I/large.jpg":[1600,1600]}' />
    </body></html>
  `;
  const image = pickBestImageFromHtml(html, "https://www.amazon.co.jp", "www.amazon.co.jp");
  assert.equal(image, "https://m.media-amazon.com/images/I/large.jpg");
});

test("Amazon CDN headers use provided Amazon referer and host detection", () => {
  assert.equal(isAmazonCdnHost("m.media-amazon.com"), true);
  assert.equal(isAmazonCdnHost("images-na.ssl-images-amazon.com"), true);
  assert.equal(isAmazonCdnHost("cdn.example.com"), false);

  const withRef = buildAmazonImageHeaders("https://www.amazon.co.jp/dp/B000000000");
  assert.equal(withRef.Referer, "https://www.amazon.co.jp/");
  assert.match(withRef.Accept, /^image\//);

  const fallback = buildAmazonImageHeaders("https://example.com/nope");
  assert.equal(fallback.Referer, "https://www.amazon.co.jp/");
});

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

test("diag store keeps ring buffer cap and exports JSONL", () => {
  let n = 0;
  const storage = createMemoryStorage();
  const store = createDiagStore({
    key: "diag_test",
    max: 2,
    storage,
    now: () => `2026-02-24T00:00:0${n++}.000Z`,
  });

  store.log({ type: "x", cardId: 1, link_url: "https://example.com/a" });
  store.log({ type: "y", cardId: 2, link_url: "https://example.com/b" });
  store.log({
    type: "thumb_error",
    cardId: 3,
    domain: "www.amazon.co.jp",
    link_url: "https://www.amazon.co.jp/dp/B000000000",
    thumbnail_url: "https://m.media-amazon.com/images/I/demo.jpg",
    extra: { proxy_url: "/api/image-proxy?url=..." },
  });

  const events = store.read();
  assert.equal(events.length, 2);
  assert.equal(events[0].type, "y");
  assert.equal(events[1].type, "thumb_error");
  assert.equal(events[1].cardId, 3);
  assert.equal(events[1].link_url, "https://www.amazon.co.jp/dp/B000000000");
  assert.equal(events[1].thumbnail_url, "https://m.media-amazon.com/images/I/demo.jpg");

  const lines = store.exportJSONL().trim().split("\n");
  assert.equal(lines.length, 2);
  const last = JSON.parse(lines[1]);
  assert.equal(last.type, "thumb_error");
  assert.equal(last.domain, "www.amazon.co.jp");
});

test("diag open_click event persists required fields", () => {
  const store = createDiagStore({
    key: "diag_click",
    storage: createMemoryStorage(),
    now: () => "2026-02-24T00:00:00.000Z",
  });
  store.log({
    type: "open_click",
    cardId: 42,
    domain: "example.com",
    link_url: "https://example.com/page",
    thumbnail_url: "https://example.com/thumb.jpg",
    extra: { clickDefaultPrevented: false, pointerDownDefaultPrevented: false },
  });

  const [event] = store.read();
  assert.equal(event.type, "open_click");
  assert.equal(event.cardId, 42);
  assert.equal(event.link_url, "https://example.com/page");
  assert.equal(event.thumbnail_url, "https://example.com/thumb.jpg");
});

test("debug flag detection accepts query or storage flag", () => {
  assert.equal(isDebugModeEnabled({ search: "?debug=1" }), true);
  assert.equal(isDebugModeEnabled({ search: "?debug=0" }), false);
  const storage = createMemoryStorage();
  storage.setItem("shinen_debug", "1");
  assert.equal(isDebugModeEnabled({ search: "", storage }), true);
});

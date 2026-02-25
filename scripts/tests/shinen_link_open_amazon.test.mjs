import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { pickBestImageFromHtml } from "../../app/api/link-preview/imageExtract.mjs";
import { buildAmazonImageHeaders, isAmazonCdnHost } from "../../app/api/image-proxy/amazonHeaders.mjs";
import {
  buildDebugBundleJSONL,
  buildDiagnosticsJSONL,
  createDiagStore,
  isDebugModeEnabled,
} from "../../app/app/shinen/lib/diag.mjs";
import {
  shouldSkipPreventDefaultForOpenLink,
  stopOpenLinkEventPropagation,
} from "../../app/app/shinen/lib/openLinkGuards.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("ThoughtCard open link anchor keeps target/rel hardening", () => {
  const thoughtCardPath = path.resolve(__dirname, "../../app/app/shinen/ThoughtCard.tsx");
  const src = fs.readFileSync(thoughtCardPath, "utf8");
  const split = src.split('data-testid="card-image-link"');
  assert.ok(split.length > 1, "card-image-link test id not found");
  const local = split[1].slice(0, 4000);
  assert.match(local, /target="_blank"/);
  assert.match(local, /rel="noopener noreferrer"/);
  assert.match(local, /data-open-link="1"/);
  assert.match(local, /onClickCapture/);
  assert.match(local, /onAuxClick/);
  assert.doesNotMatch(src, /↗ open/);
  assert.doesNotMatch(src, /data-testid="card-open-link"/);
  assert.doesNotMatch(src, /zoom-in/);
  assert.match(src, /type:\s*"open_click"/);
  assert.match(src, /type:\s*"thumb_error"/);
  assert.match(src, /cardSnapshot/);
});

test("drag and touch handlers skip preventDefault for open-link targets", () => {
  const useDragPath = path.resolve(__dirname, "../../app/app/shinen/hooks/useDrag.ts");
  const useTouchPath = path.resolve(__dirname, "../../app/app/shinen/hooks/useTouch.ts");
  const dragSrc = fs.readFileSync(useDragPath, "utf8");
  const touchSrc = fs.readFileSync(useTouchPath, "utf8");
  assert.match(dragSrc, /shouldSkipPreventDefaultForOpenLink\(\{ target \}\)/);
  assert.match(touchSrc, /shouldSkipPreventDefaultForOpenLink\(\{ target \}\)/);
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

test("bookmarklet-equivalent DOM snapshot extraction returns Amazon thumbnail", () => {
  const html = `
    <html><head></head><body>
      <div id="imgTagWrapperId">
        <img src="https://m.media-amazon.com/images/I/wrapper.jpg" />
      </div>
      <img data-a-dynamic-image='{"https://m.media-amazon.com/images/I/a.jpg":[300,300],"https://m.media-amazon.com/images/I/b.jpg":[1800,1800]}' />
    </body></html>
  `;
  const image = pickBestImageFromHtml(html, "https://www.amazon.co.jp", "www.amazon.co.jp");
  assert.equal(image, "https://m.media-amazon.com/images/I/wrapper.jpg");
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

test("capture route uses DOM snapshot extraction and forwards img param", () => {
  const capturePath = path.resolve(__dirname, "../../app/capture/page.tsx");
  const src = fs.readFileSync(capturePath, "utf8");
  assert.match(src, /pickBestImageFromHtml/);
  assert.match(src, /document\.documentElement\?\.outerHTML/);
  assert.match(src, /&img=\$\{encodeURIComponent/);
});

test("bookmarklet script keeps Amazon DOM selectors and img forwarding", () => {
  const bookmarkletPath = path.resolve(__dirname, "../../app/bookmarklet/page.tsx");
  const src = fs.readFileSync(bookmarkletPath, "utf8");
  assert.match(src, /#landingImage/);
  assert.match(src, /data-a-dynamic-image/);
  assert.match(src, /#imgTagWrapperId/);
  assert.match(src, /&img=/);
});

test("link-preview route applies strengthened Amazon page headers", () => {
  const routePath = path.resolve(__dirname, "../../app/api/link-preview/route.ts");
  const src = fs.readFileSync(routePath, "utf8");
  assert.match(src, /buildAmazonPageHeaders/);
  assert.match(src, /"Sec-Fetch-Mode": "navigate"/);
  assert.match(src, /"Sec-Fetch-User": "\?1"/);
  assert.match(src, /Referer:/);
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
  const now = () => "2026-02-24T00:00:00.000Z";
  const store = createDiagStore({
    key: "diag_click",
    storage: createMemoryStorage(),
    now,
  });
  store.log({
    type: "open_click",
    cardId: 42,
    domain: "example.com",
    link_url: "https://example.com/page",
    thumbnail_url: "https://example.com/thumb.jpg",
    extra: {
      clickDefaultPrevented: false,
      pointerDownDefaultPrevented: false,
      cardSnapshot: {
        cardId: 42,
        domain: "example.com",
        link_url: "https://example.com/page",
        thumbnail_url: "https://example.com/thumb.jpg",
      },
    },
  });

  const [event] = store.read();
  assert.equal(event.type, "open_click");
  assert.equal(event.cardId, 42);
  assert.equal(event.link_url, "https://example.com/page");
  assert.equal(event.thumbnail_url, "https://example.com/thumb.jpg");

  const lines = buildDiagnosticsJSONL({ events: store.read(), debug: true, commit: "abc1234", now })
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(lines[1].kind, "diag");
  assert.equal(lines[1].type, "open_click");
  assert.equal(lines[1].extra.cardSnapshot.link_url, "https://example.com/page");
});

test("debug flag detection accepts query or storage flag", () => {
  assert.equal(isDebugModeEnabled({ search: "?debug=1" }), true);
  assert.equal(isDebugModeEnabled({ search: "?debug=0" }), false);
  const storage = createMemoryStorage();
  storage.setItem("shinen_debug", "1");
  assert.equal(isDebugModeEnabled({ search: "", storage }), true);
});

test("diagnostics export emits diag_meta even when no events", () => {
  const jsonl = buildDiagnosticsJSONL({
    events: [],
    debug: true,
    commit: "1234567",
    now: () => "2026-02-24T00:00:00.000Z",
  });
  const lines = jsonl.split("\n").map((line) => JSON.parse(line));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].kind, "diag_meta");
  assert.equal(lines[0].events, 0);
  assert.equal(lines[0].commit, "1234567");
});

test("thumb_error export keeps cardSnapshot.thumbnail_url", () => {
  const now = () => "2026-02-24T00:00:01.000Z";
  const store = createDiagStore({
    key: "diag_thumb",
    storage: createMemoryStorage(),
    now,
  });
  store.log({
    type: "thumb_error",
    cardId: 7,
    link_url: "https://www.amazon.co.jp/dp/B000000000",
    thumbnail_url: "https://m.media-amazon.com/images/I/demo.jpg",
    extra: {
      proxy_url: "/api/image-proxy?url=x",
      cardSnapshot: {
        cardId: 7,
        domain: "www.amazon.co.jp",
        link_url: "https://www.amazon.co.jp/dp/B000000000",
        thumbnail_url: "https://m.media-amazon.com/images/I/demo.jpg",
      },
    },
  });
  const lines = buildDiagnosticsJSONL({ events: store.read(), debug: true, now })
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(lines[1].type, "thumb_error");
  assert.equal(lines[1].extra.cardSnapshot.thumbnail_url, "https://m.media-amazon.com/images/I/demo.jpg");
});

test("debug bundle export is single JSONL with meta/card/diag order", () => {
  const jsonl = buildDebugBundleJSONL({
    cards: [{ id: 1, type: 8, text: "hello", source: { url: "https://example.com", site: "example.com" } }],
    diagEvents: [
      {
        ts: "2026-02-24T00:00:02.000Z",
        type: "open_click",
        cardId: 1,
        link_url: "https://example.com",
        thumbnail_url: null,
        extra: { cardSnapshot: { link_url: "https://example.com" } },
      },
    ],
    commit: "7654321",
    version: "1.0.0",
    now: () => "2026-02-24T00:00:02.000Z",
  });
  const rows = jsonl.split("\n").map((line) => JSON.parse(line));
  assert.equal(rows[0].kind, "meta");
  assert.equal(rows[1].kind, "card");
  assert.equal(rows[2].kind, "diag_meta");
  assert.equal(rows[3].kind, "diag");
});

test("parent capture guard skips preventDefault for open-link targets", () => {
  const openLinkTarget = {
    closest(selector) {
      return selector === '[data-open-link="1"]' ? {} : null;
    },
  };
  const plainTarget = {
    closest() {
      return null;
    },
  };
  const createEvent = (target) => ({
    target,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    composedPath() {
      return [target];
    },
  });
  const parentCaptureHandler = (event) => {
    if (shouldSkipPreventDefaultForOpenLink(event)) return;
    event.preventDefault();
  };

  const openEvent = createEvent(openLinkTarget);
  parentCaptureHandler(openEvent);
  assert.equal(openEvent.defaultPrevented, false);

  const plainEvent = createEvent(plainTarget);
  parentCaptureHandler(plainEvent);
  assert.equal(plainEvent.defaultPrevented, true);
});

test("open-link propagation helper stops bubble and immediate propagation", () => {
  let stopped = false;
  let immediateStopped = false;
  stopOpenLinkEventPropagation({
    stopPropagation() {
      stopped = true;
    },
    nativeEvent: {
      stopImmediatePropagation() {
        immediateStopped = true;
      },
    },
  });
  assert.equal(stopped, true);
  assert.equal(immediateStopped, true);
});

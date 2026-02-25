import test from "node:test";
import assert from "node:assert/strict";

import {
  extractInstagramMediaFromDocument,
  extractXMediaFromDocument,
  normalizeCaptureUrl,
} from "../../app/app/shinen/lib/domMediaExtract.mjs";

function parseAttributes(rawTag) {
  const attrs = {};
  const re = /([A-Za-z_:][A-Za-z0-9_:\-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  for (const match of rawTag.matchAll(re)) {
    const key = match[1];
    attrs[key] = match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function createImage(attrs) {
  return {
    src: attrs.src || "",
    currentSrc: attrs.src || "",
    srcset: attrs.srcset || "",
    naturalWidth: Number(attrs.naturalWidth || attrs.width || 0),
    naturalHeight: Number(attrs.naturalHeight || attrs.height || 0),
    width: Number(attrs.width || 0),
    height: Number(attrs.height || 0),
    getAttribute(name) {
      return attrs[name] ?? null;
    },
  };
}

function createVideo(attrs) {
  return {
    poster: attrs.poster || "",
    videoWidth: Number(attrs.videoWidth || attrs.width || 0),
    videoHeight: Number(attrs.videoHeight || attrs.height || 0),
    width: Number(attrs.width || 0),
    height: Number(attrs.height || 0),
    getAttribute(name) {
      return attrs[name] ?? null;
    },
  };
}

function createMockDocument(html) {
  const imgNodes = [];
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    imgNodes.push(createImage(parseAttributes(match[1] || "")));
  }
  const videoNodes = [];
  for (const match of html.matchAll(/<video\b([^>]*)>/gi)) {
    videoNodes.push(createVideo(parseAttributes(match[1] || "")));
  }

  return {
    images: imgNodes,
    querySelectorAll(selector) {
      if (selector === "img") return imgNodes;
      if (selector === "img[srcset]") return imgNodes.filter((node) => Boolean(node.srcset));
      if (selector === "video") return videoNodes;
      return [];
    },
  };
}

test("X photo DOM extraction picks largest media image and upgrades to name=orig", () => {
  const doc = createMockDocument(`
    <img src="https://pbs.twimg.com/media/AAA?format=jpg&name=small" width="640" height="360" />
    <img src="https://pbs.twimg.com/media/BBB?format=jpg&name=small" width="1920" height="1080" />
  `);
  const media = extractXMediaFromDocument(doc, "https://x.com/example/status/1893753825498104139?utm_source=test");
  assert.equal(media?.kind, "image");
  assert.match(media?.url || "", /name=orig/);
  assert.match(media?.url || "", /pbs\.twimg\.com\/media\/BBB/);
});

test("X video DOM extraction prefers video poster, keeps embed, upgrades poster to name=orig", () => {
  const doc = createMockDocument(`
    <video poster="https://pbs.twimg.com/ext_tw_video_thumb/BBB?format=jpg&name=large" width="1280" height="720"></video>
    <img src="https://pbs.twimg.com/media/AAA?format=jpg&name=small" width="800" height="450" />
  `);
  const media = extractXMediaFromDocument(doc, "https://twitter.com/user/status/1893753825498104139");
  assert.equal(media?.kind, "embed");
  assert.match(media?.posterUrl || "", /name=orig/);
  assert.match(media?.embedUrl || "", /platform\.twitter\.com\/embed\/Tweet\.html/);
});

test("Instagram photo DOM extraction chooses largest srcset candidate", () => {
  const doc = createMockDocument(`
    <img
      src="https://scontent.cdninstagram.com/v/t51.2885-15/p320x320/a.jpg"
      srcset="https://scontent.cdninstagram.com/v/t51.2885-15/p320x320/a.jpg 320w, https://scontent.cdninstagram.com/v/t51.2885-15/p640x640/a.jpg 640w, https://scontent.cdninstagram.com/v/t51.2885-15/p1080x1080/a.jpg 1080w"
      width="1080"
      height="1080"
    />
  `);
  const media = extractInstagramMediaFromDocument(doc, "https://www.instagram.com/p/DGa5abc123/");
  assert.equal(media?.kind, "image");
  assert.match(media?.url || "", /p1080x1080/);
});

test("normalize and DOM extraction are idempotent", () => {
  const raw = "https://x.com/user/status/1893753825498104139?utm_source=a&utm_medium=b";
  const onceUrl = normalizeCaptureUrl(raw);
  const twiceUrl = normalizeCaptureUrl(onceUrl);
  assert.equal(onceUrl, twiceUrl);

  const doc = createMockDocument(`
    <img src="https://pbs.twimg.com/media/AAA?format=jpg&name=small" width="1280" height="720" />
  `);
  const once = extractXMediaFromDocument(doc, raw);
  const twice = extractXMediaFromDocument(doc, raw);
  assert.deepEqual(twice, once);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildEmbedMedia,
  collectImageCandidatesFromHtml,
  detectVideoFromHtml,
  extractTweetId,
  isLoginWallHtml,
  parseLargestSrcsetImage,
  parseSyndicationTweetMedia,
  selectBestImageCandidate,
} from "../../app/api/link-preview/xigMedia.mjs";
import { normalizeOnSave } from "../../app/app/shinen/lib/selfHealMigration.mjs";

test("X tweet photo prefers pbs media over logos/icons", () => {
  const html = `
    <meta property="og:image" content="https://abs.twimg.com/responsive-web/client-web/icon-default.522d363a.png" />
    <meta name="twitter:image" content="https://pbs.twimg.com/media/AbCdEfGhIjKlMnO.jpg" />
    <link rel="icon" href="https://abs.twimg.com/favicons/twitter.2.ico" />
  `;
  const candidates = collectImageCandidatesFromHtml(html, "https://x.com/user/status/123");
  const best = selectBestImageCandidate(candidates);
  assert.equal(best, "https://pbs.twimg.com/media/AbCdEfGhIjKlMnO.jpg");
});

test("X login wall rejects shared logo image and still builds embed", () => {
  const html = `
    <title>Log in to X</title>
    <meta property="og:image" content="https://abs.twimg.com/responsive-web/client-web/icon-default.522d363a.png" />
  `;
  assert.equal(isLoginWallHtml("https://x.com/user/status/123", html), true);
  const candidates = collectImageCandidatesFromHtml(html, "https://x.com/user/status/123");
  assert.equal(selectBestImageCandidate(candidates), null);
  const embed = buildEmbedMedia("https://x.com/user/status/123", html, null);
  assert.equal(embed?.kind, "embed");
  assert.match(embed?.embedUrl || "", /platform\.twitter\.com\/embed\/Tweet\.html/);
});

test("Instagram photo chooses scontent/cdn candidate over icon", () => {
  const html = `
    <meta property="og:image" content="https://scontent.cdninstagram.com/v/t51.2885-15/abc.jpg" />
    <link rel="apple-touch-icon" href="https://static.cdninstagram.com/rsrc.php/v3/yx/r/favicon-192.png" />
  `;
  const candidates = collectImageCandidatesFromHtml(html, "https://www.instagram.com/p/ABC123/");
  const best = selectBestImageCandidate(candidates);
  assert.equal(best, "https://scontent.cdninstagram.com/v/t51.2885-15/abc.jpg");
});

test("Instagram reel with og:video is treated as embed media", () => {
  const html = `
    <meta property="og:image" content="https://scontent.cdninstagram.com/v/t51.2885-15/reel.jpg" />
    <meta property="og:video" content="https://instagram.fxyz1-1.fna.fbcdn.net/v/t50.2886-16/xyz.mp4" />
  `;
  assert.equal(detectVideoFromHtml("https://www.instagram.com/reel/CODE123/", html), true);
  const embed = buildEmbedMedia(
    "https://www.instagram.com/reel/CODE123/",
    html,
    "https://scontent.cdninstagram.com/v/t51.2885-15/reel.jpg",
  );
  assert.equal(embed?.provider, "instagram");
  assert.equal(embed?.kind, "embed");
  assert.equal(embed?.embedUrl, "https://www.instagram.com/reel/CODE123/embed/");
  assert.equal(embed?.posterUrl, "https://scontent.cdninstagram.com/v/t51.2885-15/reel.jpg");
});

test("Instagram srcset parser chooses largest width candidate", () => {
  const html = `
    <img src="https://scontent.cdninstagram.com/v/t51.2885-15/p320x320/a.jpg"
         srcset="
          https://scontent.cdninstagram.com/v/t51.2885-15/p320x320/a.jpg 320w,
          https://scontent.cdninstagram.com/v/t51.2885-15/p640x640/a.jpg 640w,
          https://scontent.cdninstagram.com/v/t51.2885-15/p1080x1080/a.jpg 1080w
         " />
  `;
  const best = parseLargestSrcsetImage(html, "https://www.instagram.com/p/ABC123/embed/");
  assert.equal(best, "https://scontent.cdninstagram.com/v/t51.2885-15/p1080x1080/a.jpg");
});

test("Instagram srcset parser falls back to og:image when srcset missing", () => {
  const html = `<meta property="og:image" content="https://scontent.cdninstagram.com/v/t51.2885-15/fallback.jpg" />`;
  const best = parseLargestSrcsetImage(html, "https://www.instagram.com/p/ABC123/embed/");
  assert.equal(best, "https://scontent.cdninstagram.com/v/t51.2885-15/fallback.jpg");
});

test("X syndication parser returns high-quality image media for photo tweets", () => {
  const payload = {
    mediaDetails: [
      {
        type: "photo",
        media_url_https: "https://pbs.twimg.com/media/AbCdEfGh.jpg?format=jpg&name=small",
      },
    ],
  };
  const parsed = parseSyndicationTweetMedia(payload);
  assert.equal(parsed?.mediaKind, "image");
  assert.match(parsed?.imageUrl || "", /name=large/);
});

test("X syndication parser keeps embed kind and poster for video tweets", () => {
  const payload = {
    mediaDetails: [
      {
        type: "video",
        thumbnail_url: "https://pbs.twimg.com/ext_tw_video_thumb/1890/pu/img/Poster.jpg?name=small",
      },
    ],
  };
  const parsed = parseSyndicationTweetMedia(payload);
  assert.equal(parsed?.mediaKind, "embed");
  assert.match(parsed?.posterUrl || "", /name=large/);
});

test("extractTweetId parses status id from x.com URL", () => {
  const id = extractTweetId("https://x.com/NASA/status/1879211234567890123");
  assert.equal(id, "1879211234567890123");
});

test("URL input path upgrades plain URL text to clip card with source+type8", () => {
  const canvasPath = path.resolve("app/app/shinen/ShinenCanvas.tsx");
  const src = fs.readFileSync(canvasPath, "utf8");
  assert.match(src, /normalizeMaybeUrl/);
  assert.match(src, /type:\s*8/);
  assert.match(src, /source:\s*\{\s*url:\s*normalizedUrl,\s*site/s);
  assert.match(src, /const normalizedUrl = normalizeMaybeUrl\(text\)/);
});

test("normalizeOnSave upgrades URL-only plain note into clip card", () => {
  const draft = {
    id: 1,
    type: 2,
    text: "https://example.com/path?q=1",
    px: 0,
    py: 0,
    z: -10,
  };
  const result = normalizeOnSave(draft);
  assert.equal(result.card.type, 8);
  assert.equal(result.card.source?.url, "https://example.com/path?q=1");
  assert.equal(result.reasons.includes("guard:type8_source"), true);
});

test("normalizeOnSave upgrades source.url card to clip type", () => {
  const draft = {
    id: 2,
    type: 4,
    text: "legacy",
    px: 0,
    py: 0,
    z: -10,
    source: { url: "https://x.com/user/status/123", site: "x.com" },
  };
  const result = normalizeOnSave(draft);
  assert.equal(result.card.type, 8);
  assert.equal(result.card.source?.url, "https://x.com/user/status/123");
  assert.equal(result.reasons.includes("guard:type8_source"), true);
});

test("normalizeOnSave drops generic X login-wall thumbnail", () => {
  const draft = {
    id: 3,
    type: 8,
    text: "x card",
    px: 0,
    py: 0,
    z: -10,
    source: { url: "https://x.com/user/status/123", site: "x.com" },
    media: {
      type: "image",
      kind: "image",
      url: "https://abs.twimg.com/responsive-web/client-web/og/image.png",
    },
  };
  const result = normalizeOnSave(draft);
  assert.equal(result.card.media, undefined);
  assert.equal(result.reasons.includes("guard:drop_generic_x_thumb"), true);
});

test("normalizeOnSave is idempotent", () => {
  const draft = {
    id: 4,
    type: 2,
    text: "https://example.com",
    px: 0,
    py: 0,
    z: -10,
  };
  const once = normalizeOnSave(draft);
  const twice = normalizeOnSave(once.card);
  assert.deepEqual(twice.card, once.card);
});

test("MEMO chip is anchored on the left side in card footer", () => {
  const thoughtCardPath = path.resolve("app/app/shinen/ThoughtCard.tsx");
  const src = fs.readFileSync(thoughtCardPath, "utf8");
  const memoIdx = src.indexOf('data-testid="chip-memo"');
  const tagIdx = src.indexOf('data-testid="chip-tag"');
  assert.ok(memoIdx >= 0, "chip-memo should exist");
  assert.ok(tagIdx >= 0, "chip-tag should exist");
  assert.ok(memoIdx < tagIdx, "memo chip should be rendered before tag chip");
  assert.match(src, /data-testid="chip-memo"[\s\S]*?marginLeft:\s*0/s);
});

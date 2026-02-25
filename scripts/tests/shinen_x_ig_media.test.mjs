import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmbedMedia,
  collectImageCandidatesFromHtml,
  detectVideoFromHtml,
  isLoginWallHtml,
  selectBestImageCandidate,
} from "../../app/api/link-preview/xigMedia.mjs";

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

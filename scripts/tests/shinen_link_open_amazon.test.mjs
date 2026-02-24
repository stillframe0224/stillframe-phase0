import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { pickBestImageFromHtml } from "../../app/api/link-preview/imageExtract.mjs";
import { buildAmazonImageHeaders, isAmazonCdnHost } from "../../app/api/image-proxy/amazonHeaders.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("ThoughtCard open link anchor keeps target/rel hardening", () => {
  const thoughtCardPath = path.resolve(__dirname, "../../app/app/shinen/ThoughtCard.tsx");
  const src = fs.readFileSync(thoughtCardPath, "utf8");
  const split = src.split('data-testid="card-open-link"');
  assert.ok(split.length > 1, "card-open-link test id not found");
  const local = split[1].slice(0, 2000);
  assert.match(local, /target="_blank"/);
  assert.match(local, /rel="noopener noreferrer"/);
  assert.match(local, /↗ open/);
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

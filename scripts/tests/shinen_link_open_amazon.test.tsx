import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ThoughtCard from "../../app/app/shinen/ThoughtCard";
import type { ShinenCard } from "../../app/app/shinen/lib/types";
import { pickBestImageFromHtml } from "../../app/api/link-preview/imageExtract";
import { buildAmazonImageHeaders, isAmazonCdnHost } from "../../app/api/image-proxy/amazonHeaders";

function baseCard(overrides: Partial<ShinenCard> = {}): ShinenCard {
  return {
    id: 1,
    type: 8,
    text: "sample",
    px: 0,
    py: 0,
    z: 0,
    source: { url: "https://example.com/article", site: "example" },
    ...overrides,
  };
}

test("ThoughtCard open link renders anchor with target/rel even when not hovered", () => {
  const html = renderToStaticMarkup(
    <ThoughtCard
      card={baseCard()}
      p={{ sx: 0, sy: 0, s: 1, z2: 1 }}
      camRx={0}
      camRy={0}
      isDragging={false}
      isHovered={false}
      isSelected={false}
      time={0}
      onPointerDown={() => {}}
      onEnter={() => {}}
      onLeave={() => {}}
    />,
  );

  assert.match(html, /data-testid="card-open-link"/);
  assert.match(html, /href="https:\/\/example.com\/article"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
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

  const withRef = buildAmazonImageHeaders("https://www.amazon.co.jp/dp/B000000000") as Record<string, string>;
  assert.equal(withRef.Referer, "https://www.amazon.co.jp/");
  assert.match(withRef.Accept, /^image\//);

  const fallback = buildAmazonImageHeaders("https://example.com/nope") as Record<string, string>;
  assert.equal(fallback.Referer, "https://www.amazon.co.jp/");
});

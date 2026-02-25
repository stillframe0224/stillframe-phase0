import assert from "node:assert/strict";
import test from "node:test";
import { getThumbRenderMode } from "../../app/app/shinen/lib/thumbRender.mjs";
import {
  pickLargestInstagramImageCandidate,
  upgradeInstagramUrl,
} from "../../app/api/link-preview/instagramImage.mjs";

test("SmartFit render mode uses contain_blur for amazon and fanza/dmm domains", () => {
  assert.equal(getThumbRenderMode("https://www.amazon.co.jp/dp/B000000000"), "contain_blur");
  assert.equal(getThumbRenderMode("amazon.com"), "contain_blur");
  assert.equal(getThumbRenderMode("fanza.dmm.co.jp"), "contain_blur");
  assert.equal(getThumbRenderMode("shop.dmm.co.jp"), "contain_blur");
  assert.equal(getThumbRenderMode("https://example.com/article"), "cover");
});

test("upgradeInstagramUrl promotes low resolution instagram tokens to 1080", () => {
  const src = "https://scontent.cdninstagram.com/v/t51.2885-15/p640x640/abc.jpg?stp=dst-jpg_s320x320&width=640&height=640";
  const upgraded = upgradeInstagramUrl(src);
  assert.match(upgraded, /p1080x1080/);
  assert.match(upgraded, /s1080x1080/);
  assert.match(upgraded, /width=1080/);
  assert.match(upgraded, /height=1080/);

  const unchanged = "https://example.com/p640x640/image.jpg";
  assert.equal(upgradeInstagramUrl(unchanged), unchanged);
});

test("pickLargestInstagramImageCandidate chooses largest non-icon currentSrc", () => {
  const picked = pickLargestInstagramImageCandidate([
    {
      currentSrc: "https://scontent.cdninstagram.com/v/t51.2885-15/p640x640/icon-avatar.jpg",
      naturalWidth: 2048,
      naturalHeight: 2048,
    },
    {
      currentSrc: "https://scontent.cdninstagram.com/v/t51.2885-15/s150x150/small.jpg",
      naturalWidth: 150,
      naturalHeight: 150,
    },
    {
      currentSrc: "https://scontent.cdninstagram.com/v/t51.2885-15/p640x640/main.jpg",
      naturalWidth: 640,
      naturalHeight: 640,
    },
    {
      currentSrc: "https://scontent.cdninstagram.com/v/t51.2885-15/p1080x1080/hero.jpg",
      naturalWidth: 1080,
      naturalHeight: 1080,
    },
  ]);

  assert.equal(
    picked,
    "https://scontent.cdninstagram.com/v/t51.2885-15/p1080x1080/hero.jpg",
  );
});

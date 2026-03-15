import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("extension popup treats X photo capture as image (not embed)", () => {
  const popupPath = path.resolve("chrome-extension/popup/popup.js");
  const src = fs.readFileSync(popupPath, "utf8");
  assert.match(src, /if \(bestImage\) return \{ mk: "image", provider: "x", embed: "", poster: bestImage, img: bestImage \};/);
  assert.doesNotMatch(src, /if \(bestImage\) return \{ mk: "embed", provider: "x"/);
});

test("extension popup avoids enqueue when opening new SHINEN tab", () => {
  const popupPath = path.resolve("chrome-extension/popup/popup.js");
  const src = fs.readFileSync(popupPath, "utf8");
  assert.match(src, /if \(shinenTabs\.length === 0\)[\s\S]*await chrome\.tabs\.create\(/);
  assert.match(src, /else \{[\s\S]*await enqueue\(chrome\.storage\.local, clipData\);[\s\S]*\}/);
});

test("background fallback marks X photos as image and clears embed param", () => {
  const backgroundPath = path.resolve("chrome-extension/background.js");
  const src = fs.readFileSync(backgroundPath, "utf8");
  assert.match(src, /mk = bestPoster \? 'embed' : \(img \? 'image' : \(embed \? 'embed' : ''\)\);/);
  assert.match(src, /if \(mk !== 'embed'\) \{\s*embed = '';\s*\}/);
});

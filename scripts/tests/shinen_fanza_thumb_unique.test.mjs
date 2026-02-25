import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseCoverByProbe,
  extractCid,
  inferDmmCoverCandidates,
  isAgeGateHtml,
} from "../../app/api/link-preview/fanzaThumb.mjs";

test("isAgeGateHtml detects FANZA age gate markers", () => {
  const html = `
    <html>
      <head><title>年齢認証 - FANZA</title></head>
      <body>この先は18歳以上の方のみご利用いただけます。</body>
    </html>
  `;
  assert.equal(isAgeGateHtml(html, "https://www.dmm.co.jp/age_check/"), true);
  assert.equal(isAgeGateHtml("<html><title>Product</title></html>", "https://www.dmm.co.jp/"), false);
});

test("extractCid supports query and path cid formats", () => {
  assert.equal(
    extractCid("https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=abcd00123/"),
    "abcd00123",
  );
  assert.equal(
    extractCid("https://www.dmm.co.jp/mono/dvd/-/detail/=/?cid=efgh00456"),
    "efgh00456",
  );
  assert.equal(extractCid("https://www.dmm.co.jp/"), null);
});

test("inferDmmCoverCandidates builds expected priority list", () => {
  const cid = "abcd00123";
  const candidates = inferDmmCoverCandidates(cid);
  assert.deepEqual(candidates, [
    "https://pics.dmm.co.jp/digital/video/abcd00123/abcd00123pl.jpg",
    "https://pics.dmm.co.jp/digital/video/abcd00123/abcd00123ps.jpg",
    "https://pics.dmm.co.jp/digital/book/abcd00123/abcd00123pl.jpg",
    "https://pics.dmm.co.jp/digital/comic/abcd00123/abcd00123pl.jpg",
  ]);
});

test("chooseCoverByProbe returns first successful candidate", async () => {
  const calls = [];
  const probe = async (url) => {
    calls.push(url);
    return url.endsWith("ps.jpg");
  };
  const picked = await chooseCoverByProbe("abcd00123", probe);
  assert.equal(picked, "https://pics.dmm.co.jp/digital/video/abcd00123/abcd00123ps.jpg");
  assert.equal(calls.length, 2);
  assert.equal(calls[0], "https://pics.dmm.co.jp/digital/video/abcd00123/abcd00123pl.jpg");
});

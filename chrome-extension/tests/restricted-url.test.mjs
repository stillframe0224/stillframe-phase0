import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRestrictedUrl } from "../lib/restricted-url.js";

describe("isRestrictedUrl", () => {
  it("returns true for undefined", () => {
    assert.equal(isRestrictedUrl(undefined), true);
  });

  it("returns true for null", () => {
    assert.equal(isRestrictedUrl(null), true);
  });

  it("returns true for empty string", () => {
    assert.equal(isRestrictedUrl(""), true);
  });

  it("returns true for chrome:// URLs", () => {
    assert.equal(isRestrictedUrl("chrome://extensions"), true);
    assert.equal(isRestrictedUrl("chrome://newtab"), true);
    assert.equal(isRestrictedUrl("chrome://settings"), true);
    assert.equal(isRestrictedUrl("Chrome://Extensions"), true); // case insensitive
  });

  it("returns true for chrome-extension:// URLs", () => {
    assert.equal(isRestrictedUrl("chrome-extension://abc123/popup.html"), true);
  });

  it("returns true for edge:// URLs", () => {
    assert.equal(isRestrictedUrl("edge://settings"), true);
  });

  it("returns true for about: URLs", () => {
    assert.equal(isRestrictedUrl("about:blank"), true);
    assert.equal(isRestrictedUrl("about:newtab"), true);
  });

  it("returns true for file:// URLs", () => {
    assert.equal(isRestrictedUrl("file:///home/user/doc.html"), true);
  });

  it("returns true for view-source: URLs", () => {
    assert.equal(isRestrictedUrl("view-source:https://example.com"), true);
  });

  it("returns false for http:// URLs", () => {
    assert.equal(isRestrictedUrl("http://example.com"), false);
  });

  it("returns false for https:// URLs", () => {
    assert.equal(isRestrictedUrl("https://example.com"), false);
    assert.equal(isRestrictedUrl("https://youtube.com/watch?v=abc"), false);
    assert.equal(isRestrictedUrl("https://stillframe-phase0.vercel.app/app"), false);
  });
});

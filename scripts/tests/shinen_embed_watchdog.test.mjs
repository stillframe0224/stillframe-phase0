import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  completeEmbedLoad,
  createEmbedLoadState,
  isEmbedTimedOut,
  startEmbedLoad,
  timeoutEmbedLoad,
} from "../../app/app/shinen/lib/embedWatchdog.mjs";
import { buildDiagnosticsJSONL, createDiagStore } from "../../app/app/shinen/lib/diag.mjs";

test("embed watchdog transitions to timeout when onLoad never arrives", () => {
  let state = createEmbedLoadState(7000);
  state = startEmbedLoad(state, 1000);
  assert.equal(state.status, "loading");
  assert.equal(isEmbedTimedOut(state, 7999), false);
  assert.equal(isEmbedTimedOut(state, 8000), true);
  state = timeoutEmbedLoad(state, 8000);
  assert.equal(state.status, "timeout");
  assert.equal(state.elapsedMs, 7000);
});

test("embed watchdog stays loaded when onLoad arrives before timeout", () => {
  let state = createEmbedLoadState(7000);
  state = startEmbedLoad(state, 1000);
  state = completeEmbedLoad(state, 2500);
  assert.equal(state.status, "loaded");
  assert.equal(state.elapsedMs, 1500);
  assert.equal(isEmbedTimedOut(state, 9000), false);
});

test("diag export includes embed load start and timeout events", () => {
  const storageState = new Map();
  const store = createDiagStore({
    key: "diag_embed_watchdog",
    storage: {
      getItem(key) {
        return storageState.has(key) ? storageState.get(key) : null;
      },
      setItem(key, value) {
        storageState.set(key, String(value));
      },
      removeItem(key) {
        storageState.delete(key);
      },
    },
    now: () => "2026-02-25T00:00:00.000Z",
  });

  store.log({
    type: "embed_load_start",
    cardId: 101,
    domain: "x.com",
    link_url: "https://x.com/user/status/1",
    thumbnail_url: "https://pbs.twimg.com/media/demo.jpg",
    extra: { provider: "x", embedUrl: "https://platform.twitter.com/embed/Tweet.html?dnt=1&url=..." },
  });
  store.log({
    type: "embed_load_timeout",
    cardId: 101,
    domain: "x.com",
    link_url: "https://x.com/user/status/1",
    thumbnail_url: "https://pbs.twimg.com/media/demo.jpg",
    extra: { provider: "x", elapsedMs: 7000 },
  });

  const jsonl = buildDiagnosticsJSONL({ events: store.read(), debug: true });
  assert.match(jsonl, /"type":"embed_load_start"/);
  assert.match(jsonl, /"type":"embed_load_timeout"/);
});

test("timeout fallback UI exposes external open link and retry controls", () => {
  const thoughtCardPath = path.resolve("app/app/shinen/ThoughtCard.tsx");
  const src = fs.readFileSync(thoughtCardPath, "utf8");
  assert.match(src, /data-testid="embed-timeout-fallback"/);
  assert.match(src, /data-testid="embed-open-external"/);
  assert.match(src, /href=\{embedLinkUrl\}/);
  assert.match(src, /data-testid="embed-retry"/);
  assert.match(src, /"embed_open_external"/);
  assert.match(src, /"embed_load_start"/);
  assert.match(src, /"embed_load_ok"/);
  assert.match(src, /"embed_load_timeout"/);
  assert.match(src, /"embed_retry"/);
});

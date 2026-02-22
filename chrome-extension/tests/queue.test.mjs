import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getQueue,
  setQueue,
  enqueue,
  dequeueByAck,
  QUEUE_KEY,
  MAX_QUEUE,
} from "../lib/queue.js";

// In-memory mock of chrome.storage.local
function createMockStorage() {
  const store = {};
  return {
    get(key) {
      if (typeof key === "string") {
        return Promise.resolve({ [key]: store[key] });
      }
      // key is an array or object
      const result = {};
      const keys = Array.isArray(key) ? key : Object.keys(key);
      for (const k of keys) result[k] = store[k];
      return Promise.resolve(result);
    },
    set(obj) {
      Object.assign(store, obj);
      return Promise.resolve();
    },
    _store: store,
  };
}

describe("Queue SSOT", () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it("getQueue returns empty array when no queue exists", async () => {
    const q = await getQueue(storage);
    assert.deepEqual(q, []);
  });

  it("enqueue adds an item with clipId and nonce", async () => {
    const item = await enqueue(storage, { url: "https://example.com", title: "Test" });
    assert.ok(item.clipId.startsWith("clip_"));
    assert.ok(item.nonce.length > 5);
    assert.equal(item.data.url, "https://example.com");
    assert.equal(item.data.title, "Test");
    assert.ok(item.enqueuedAt > 0);

    const q = await getQueue(storage);
    assert.equal(q.length, 1);
    assert.equal(q[0].clipId, item.clipId);
  });

  it("enqueue multiple items preserves order", async () => {
    const a = await enqueue(storage, { title: "A" });
    const b = await enqueue(storage, { title: "B" });
    const c = await enqueue(storage, { title: "C" });

    const q = await getQueue(storage);
    assert.equal(q.length, 3);
    assert.equal(q[0].clipId, a.clipId);
    assert.equal(q[1].clipId, b.clipId);
    assert.equal(q[2].clipId, c.clipId);
  });

  it("enqueue drops oldest when over MAX_QUEUE", async () => {
    // Fill to MAX_QUEUE + 5
    const items = [];
    for (let i = 0; i < MAX_QUEUE + 5; i++) {
      items.push(await enqueue(storage, { idx: i }));
    }

    const q = await getQueue(storage);
    assert.equal(q.length, MAX_QUEUE);
    // The first 5 should have been dropped
    assert.equal(q[0].data.idx, 5);
  });

  describe("dequeueByAck", () => {
    it("removes item when clipId and nonce match", async () => {
      const item = await enqueue(storage, { title: "Test" });
      const removed = await dequeueByAck(storage, item.clipId, item.nonce);
      assert.equal(removed, true);

      const q = await getQueue(storage);
      assert.equal(q.length, 0);
    });

    it("does NOT remove when nonce mismatches", async () => {
      const item = await enqueue(storage, { title: "Test" });
      const removed = await dequeueByAck(storage, item.clipId, "wrong-nonce");
      assert.equal(removed, false);

      const q = await getQueue(storage);
      assert.equal(q.length, 1);
    });

    it("does NOT remove when clipId not found", async () => {
      await enqueue(storage, { title: "Test" });
      const removed = await dequeueByAck(storage, "unknown-clip-id", "any-nonce");
      assert.equal(removed, false);

      const q = await getQueue(storage);
      assert.equal(q.length, 1);
    });

    it("only removes the matching item", async () => {
      const a = await enqueue(storage, { title: "A" });
      const b = await enqueue(storage, { title: "B" });
      const c = await enqueue(storage, { title: "C" });

      await dequeueByAck(storage, b.clipId, b.nonce);

      const q = await getQueue(storage);
      assert.equal(q.length, 2);
      assert.equal(q[0].clipId, a.clipId);
      assert.equal(q[1].clipId, c.clipId);
    });
  });
});

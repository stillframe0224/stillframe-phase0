import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getQueue,
  setQueue,
  enqueue,
  dequeueByAck,
  migrateFromLocalStorage,
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

  describe("migrateFromLocalStorage", () => {
    // Mock localStorage for migration tests
    function createMockLocalStorage(items) {
      const store = { ...items };
      return {
        getItem(key) { return store[key] ?? null; },
        removeItem(key) { delete store[key]; },
        _store: store,
      };
    }

    it("migrates shinen_clip_queue (underscore key)", async () => {
      const mockLS = createMockLocalStorage({
        shinen_clip_queue: JSON.stringify([
          { clipId: "c1", nonce: "n1", data: { title: "A" }, enqueuedAt: 100 },
        ]),
      });
      // Inject mock localStorage
      globalThis.localStorage = mockLS;

      const s = createMockStorage();
      await migrateFromLocalStorage(s);

      const q = await getQueue(s);
      assert.equal(q.length, 1);
      assert.equal(q[0].clipId, "c1");
      assert.equal(q[0].data.title, "A");
      // localStorage key removed
      assert.equal(mockLS._store["shinen_clip_queue"], undefined);

      delete globalThis.localStorage;
    });

    it("migrates shinen-clip-queue (hyphen key)", async () => {
      const mockLS = createMockLocalStorage({
        "shinen-clip-queue": JSON.stringify([
          { clipId: "c2", nonce: "n2", data: { title: "B" }, enqueuedAt: 200 },
        ]),
      });
      globalThis.localStorage = mockLS;

      const s = createMockStorage();
      await migrateFromLocalStorage(s);

      const q = await getQueue(s);
      assert.equal(q.length, 1);
      assert.equal(q[0].clipId, "c2");
      assert.equal(q[0].data.title, "B");
      assert.equal(mockLS._store["shinen-clip-queue"], undefined);

      delete globalThis.localStorage;
    });

    it("merges both keys and deduplicates by clipId", async () => {
      const mockLS = createMockLocalStorage({
        shinen_clip_queue: JSON.stringify([
          { clipId: "dup", nonce: "n1", data: { title: "First" }, enqueuedAt: 100 },
          { clipId: "only_underscore", nonce: "n2", data: { title: "U" }, enqueuedAt: 200 },
        ]),
        "shinen-clip-queue": JSON.stringify([
          { clipId: "dup", nonce: "n3", data: { title: "Dupe" }, enqueuedAt: 300 },
          { clipId: "only_hyphen", nonce: "n4", data: { title: "H" }, enqueuedAt: 400 },
        ]),
      });
      globalThis.localStorage = mockLS;

      const s = createMockStorage();
      await migrateFromLocalStorage(s);

      const q = await getQueue(s);
      // 3 unique items (dup appears once — first wins)
      assert.equal(q.length, 3);
      const ids = q.map((i) => i.clipId);
      assert.ok(ids.includes("dup"));
      assert.ok(ids.includes("only_underscore"));
      assert.ok(ids.includes("only_hyphen"));
      // First occurrence of "dup" wins
      const dupItem = q.find((i) => i.clipId === "dup");
      assert.equal(dupItem.data.title, "First");

      // Both keys removed
      assert.equal(mockLS._store["shinen_clip_queue"], undefined);
      assert.equal(mockLS._store["shinen-clip-queue"], undefined);

      delete globalThis.localStorage;
    });

    it("does not run migration twice", async () => {
      const mockLS = createMockLocalStorage({
        shinen_clip_queue: JSON.stringify([
          { clipId: "c1", nonce: "n1", data: { title: "A" }, enqueuedAt: 100 },
        ]),
      });
      globalThis.localStorage = mockLS;

      const s = createMockStorage();
      await migrateFromLocalStorage(s);
      assert.equal((await getQueue(s)).length, 1);

      // Second call: add new items to localStorage — should be ignored
      mockLS._store.shinen_clip_queue = JSON.stringify([
        { clipId: "c9", nonce: "n9", data: { title: "New" }, enqueuedAt: 900 },
      ]);
      await migrateFromLocalStorage(s);
      assert.equal((await getQueue(s)).length, 1); // Still 1, second run skipped

      delete globalThis.localStorage;
    });
  });
});

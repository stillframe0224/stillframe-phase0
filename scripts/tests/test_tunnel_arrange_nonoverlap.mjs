import test from "node:test";
import assert from "node:assert/strict";
import { arrangeGridNonOverlap, countOverlapPairs } from "../../app/app/tunnelArrange.js";

test("non-overlap arrange: N=12/50/200 -> overlapPairs=0", () => {
  for (const N of [12, 50, 200]) {
    const ids = Array.from({ length: N }, (_, i) => `c-${i}`);
    const positions = arrangeGridNonOverlap(ids);
    assert.equal(countOverlapPairs(positions), 0, `expected no overlaps for N=${N}`);
  }
});

test("deterministic output for same input", () => {
  const ids = Array.from({ length: 50 }, (_, i) => `c-${i}`);
  const a = arrangeGridNonOverlap(ids);
  const b = arrangeGridNonOverlap(ids);
  assert.deepEqual(a, b);
});

import test from "node:test";
import assert from "node:assert/strict";
import { arrangeGridNonOverlap, countOverlapPairs } from "../../app/app/tunnelArrange.js";
import { hasFinitePositions, normalizeTunnelLayout } from "../../app/app/tunnelStateGuards.js";

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

test("loadState guard: positions must be finite", () => {
  assert.equal(hasFinitePositions({ a: { x: 1, y: 2, z: 0 } }), true);
  assert.equal(hasFinitePositions({ a: { x: Number.NaN, y: 2, z: 0 } }), false);
  assert.equal(hasFinitePositions({ a: { x: 1, y: Number.POSITIVE_INFINITY, z: 0 } }), false);
});

test("unknown layout falls back to scatter", () => {
  assert.equal(normalizeTunnelLayout("grid"), "grid");
  assert.equal(normalizeTunnelLayout("unknown-layout"), "scatter");
});

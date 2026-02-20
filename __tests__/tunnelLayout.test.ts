import { describe, it, expect } from "vitest";
import {
  aabbOverlap,
  autoArrange,
  screenToWorld,
  worldToScreen,
  countOverlapPairs,
  type Rect,
  type Position3D,
  CARD_DEFAULT_W,
  CARD_DEFAULT_H,
} from "../app/app/tunnelLayout";

describe("aabbOverlap", () => {
  it("detects clear overlap", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const b: Rect = { x: 50, y: 50, w: 100, h: 100 };
    expect(aabbOverlap(a, b, 0)).toBe(true);
  });

  it("returns false for non-overlapping rects", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const b: Rect = { x: 200, y: 200, w: 100, h: 100 };
    expect(aabbOverlap(a, b, 0)).toBe(false);
  });

  it("returns false for adjacent rects (touching but no overlap)", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const b: Rect = { x: 100, y: 0, w: 100, h: 100 };
    // With epsilon=0, exactly adjacent is not overlapping
    expect(aabbOverlap(a, b, 0)).toBe(false);
  });

  it("epsilon expands collision zone", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const b: Rect = { x: 100, y: 0, w: 100, h: 100 };
    // With epsilon=1, adjacent rects now overlap
    expect(aabbOverlap(a, b, 1)).toBe(true);
  });

  it("epsilon edge case: gap exactly equals epsilon", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    // b starts at 101 — 1px gap
    const b: Rect = { x: 101, y: 0, w: 100, h: 100 };
    // epsilon=1: a extends to 101 (100 + 1), b starts at 101 → touching
    expect(aabbOverlap(a, b, 1)).toBe(false);
  });

  it("handles zero-size rects", () => {
    const a: Rect = { x: 50, y: 50, w: 0, h: 0 };
    const b: Rect = { x: 50, y: 50, w: 0, h: 0 };
    // Two zero-size rects at same point: no overlap with epsilon=0
    expect(aabbOverlap(a, b, 0)).toBe(false);
    // With epsilon, they overlap
    expect(aabbOverlap(a, b, 1)).toBe(true);
  });
});

describe("screenToWorld / worldToScreen roundtrip", () => {
  it("roundtrips with zoom=1 pan=0", () => {
    const cam = { x: 0, y: 0, zoom: 1 };
    const w = screenToWorld(150, 250, cam);
    const s = worldToScreen(w.x, w.y, cam);
    expect(s.x).toBeCloseTo(150, 5);
    expect(s.y).toBeCloseTo(250, 5);
  });

  it("roundtrips with zoom=2 and pan", () => {
    const cam = { x: 100, y: -50, zoom: 2 };
    const w = screenToWorld(300, 200, cam);
    const s = worldToScreen(w.x, w.y, cam);
    expect(s.x).toBeCloseTo(300, 5);
    expect(s.y).toBeCloseTo(200, 5);
  });

  it("roundtrips with small zoom", () => {
    const cam = { x: -200, y: 300, zoom: 0.3 };
    const w = screenToWorld(500, 400, cam);
    const s = worldToScreen(w.x, w.y, cam);
    expect(s.x).toBeCloseTo(500, 4);
    expect(s.y).toBeCloseTo(400, 4);
  });

  it("error stays below 1e-10", () => {
    const cam = { x: 123.456, y: -789.012, zoom: 1.5 };
    const sx = 999.999;
    const sy = -111.111;
    const w = screenToWorld(sx, sy, cam);
    const s = worldToScreen(w.x, w.y, cam);
    expect(Math.abs(s.x - sx)).toBeLessThan(1e-10);
    expect(Math.abs(s.y - sy)).toBeLessThan(1e-10);
  });
});

describe("autoArrange", () => {
  it("returns deterministic output for same input", () => {
    const sizes = new Map([
      ["a", { w: 200, h: 250 }],
      ["b", { w: 200, h: 250 }],
      ["c", { w: 200, h: 250 }],
    ]);
    const r1 = autoArrange(sizes, 1200, 800);
    const r2 = autoArrange(sizes, 1200, 800);
    expect(r1.positions).toEqual(r2.positions);
  });

  it("produces zero overlaps for 100 cards", () => {
    const sizes = new Map<string, { w: number; h: number }>();
    for (let i = 0; i < 100; i++) {
      // Random sizes between 150-300
      const w = 150 + (i * 17) % 150;
      const h = 200 + (i * 23) % 150;
      sizes.set(`card-${String(i).padStart(3, "0")}`, { w, h });
    }
    const { positions } = autoArrange(sizes, 1200, 800);
    const { overlapPairs } = countOverlapPairs(positions, sizes);
    expect(overlapPairs).toBe(0);
  });

  it("excludes zero-size cards", () => {
    const sizes = new Map([
      ["a", { w: 200, h: 250 }],
      ["b", { w: 0, h: 0 }],
      ["c", { w: 200, h: 250 }],
    ]);
    const { positions, zeroSizeCount } = autoArrange(sizes, 1200, 800);
    expect(zeroSizeCount).toBe(1);
    expect(positions["b"]).toBeUndefined();
    expect(positions["a"]).toBeDefined();
    expect(positions["c"]).toBeDefined();
  });

  it("handles empty input", () => {
    const sizes = new Map();
    const { positions } = autoArrange(sizes, 1200, 800);
    expect(Object.keys(positions)).toHaveLength(0);
  });

  it("falls back to grid when placement fails", () => {
    // Very narrow viewport to force grid fallback
    const sizes = new Map<string, { w: number; h: number }>();
    for (let i = 0; i < 20; i++) {
      sizes.set(`card-${i}`, { w: CARD_DEFAULT_W, h: CARD_DEFAULT_H });
    }
    const { positions } = autoArrange(sizes, 300, 300);
    expect(Object.keys(positions).length).toBe(20);
  });
});

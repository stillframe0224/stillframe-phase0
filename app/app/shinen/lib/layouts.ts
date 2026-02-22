import { TILE_GX, TILE_GY } from "./constants";
import type { ShinenCard } from "./types";

type PartialPos = Pick<ShinenCard, "px" | "py" | "z">;

export function layoutScatter(cards: ShinenCard[]): ShinenCard[] {
  return cards.map((c) => ({
    ...c,
    px: (Math.random() - 0.5) * 1200,
    py: (Math.random() - 0.5) * 600,
    z: -20 - Math.random() * 460,
  }));
}

export function layoutGrid(cards: ShinenCard[]): ShinenCard[] {
  const n = cards.length;
  const cols = Math.ceil(Math.sqrt(n));
  const gx = 230, gy = 150;
  const ox = -((cols - 1) * gx) / 2;
  const rows = Math.ceil(n / cols);
  const oy = -((rows - 1) * gy) / 2;
  return cards.map((c, i) => ({
    ...c,
    px: ox + (i % cols) * gx,
    py: oy + Math.floor(i / cols) * gy,
    z: -80,
  }));
}

export function layoutCircle(cards: ShinenCard[]): ShinenCard[] {
  const n = cards.length;
  const rad = Math.min(380, 100 + n * 22);
  return cards.map((c, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      ...c,
      px: Math.cos(a) * rad,
      py: Math.sin(a) * rad * 0.55,
      z: -120 + Math.sin(a) * 80,
    };
  });
}

export function layoutTiles(cards: ShinenCard[]): ShinenCard[] {
  const cols = Math.ceil(Math.sqrt(cards.length));
  const ox = -((cols - 1) * TILE_GX) / 2;
  const rows = Math.ceil(cards.length / cols);
  const oy = -((rows - 1) * TILE_GY) / 2;
  return cards.map((c, i) => ({
    ...c,
    px: ox + (i % cols) * TILE_GX,
    py: oy + Math.floor(i / cols) * TILE_GY,
    z: -300,
  }));
}

export function layoutTriangle(cards: ShinenCard[]): ShinenCard[] {
  const n = cards.length;
  if (n === 0) return cards;
  const size = 400;
  // equilateral triangle vertices
  const verts: [number, number][] = [
    [0, -size * 0.6],
    [-size * 0.55, size * 0.35],
    [size * 0.55, size * 0.35],
  ];
  const perimeter = 3; // 3 sides
  return cards.map((c, i) => {
    const t = (i / n) * perimeter;
    const side = Math.min(Math.floor(t), 2);
    const frac = t - side;
    const [x1, y1] = verts[side];
    const [x2, y2] = verts[(side + 1) % 3];
    return {
      ...c,
      px: x1 + (x2 - x1) * frac,
      py: y1 + (y2 - y1) * frac,
      z: -200 + Math.sin((i / n) * Math.PI * 2) * 100,
    };
  });
}

const LAYOUT_FNS = [layoutScatter, layoutGrid, layoutCircle, layoutTiles, layoutTriangle] as const;

export function applyLayout(name: string, cards: ShinenCard[]): ShinenCard[] {
  const idx = ["scatter", "grid", "circle", "tiles", "triangle"].indexOf(name);
  if (idx < 0) return cards;
  return LAYOUT_FNS[idx](cards);
}

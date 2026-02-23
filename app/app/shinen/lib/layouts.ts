import { getCardWidth, CARD_HEIGHT_DEFAULT } from "./constants";
import type { ShinenCard } from "./types";

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
  if (n === 0) return cards;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cw = getCardWidth();
  const ch = CARD_HEIGHT_DEFAULT;
  const GAP = 30;

  // Fixed-size grid — ignore card.w/card.h to prevent overlap
  const colX = [0];
  for (let c = 1; c < cols; c++) colX[c] = colX[c - 1] + cw + GAP;
  const rowY = [0];
  for (let r = 1; r < rows; r++) rowY[r] = rowY[r - 1] + ch + GAP;

  const totalW = colX[cols - 1] + cw;
  const totalH = rowY[rows - 1] + ch;

  return cards.map((c, i) => ({
    ...c,
    px: colX[i % cols] - totalW / 2 + cw / 2,
    py: rowY[Math.floor(i / cols)] - totalH / 2 + ch / 2,
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
  const n = cards.length;
  if (n === 0) return cards;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cw = getCardWidth();
  const ch = Math.round(CARD_HEIGHT_DEFAULT * 0.75);
  const GAP = 30;

  // Fixed-size tiles — ignore card.w/card.h to prevent overlap
  const colX = [0];
  for (let c = 1; c < cols; c++) colX[c] = colX[c - 1] + cw + GAP;
  const rowY = [0];
  for (let r = 1; r < rows; r++) rowY[r] = rowY[r - 1] + ch + GAP;

  const totalW = colX[cols - 1] + cw;
  const totalH = rowY[rows - 1] + ch;

  return cards.map((c, i) => ({
    ...c,
    px: colX[i % cols] - totalW / 2 + cw / 2,
    py: rowY[Math.floor(i / cols)] - totalH / 2 + ch / 2,
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

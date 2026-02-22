import { getCardWidth } from "./constants";
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
  if (n === 0) return cards;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cw = getCardWidth();
  const GAP = 30;

  // Compute per-column max width and per-row max height
  const colW = new Array(cols).fill(cw);
  const rowH = new Array(rows).fill(cw * 0.75);
  cards.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    colW[col] = Math.max(colW[col], (c.w ?? cw));
    rowH[row] = Math.max(rowH[row], (c.h ?? cw * 0.75));
  });

  // Prefix sums for offsets
  const colX = [0];
  for (let c = 1; c < cols; c++) colX[c] = colX[c - 1] + colW[c - 1] + GAP;
  const rowY = [0];
  for (let r = 1; r < rows; r++) rowY[r] = rowY[r - 1] + rowH[r - 1] + GAP;

  const totalW = colX[cols - 1] + colW[cols - 1];
  const totalH = rowY[rows - 1] + rowH[rows - 1];

  return cards.map((c, i) => ({
    ...c,
    px: colX[i % cols] - totalW / 2 + (c.w ?? cw) / 2,
    py: rowY[Math.floor(i / cols)] - totalH / 2 + (c.h ?? cw * 0.75) / 2,
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
  const GAP = 30;
  const defH = cw * 0.65;

  // Compute per-column max width and per-row max height
  const colW = new Array(cols).fill(cw);
  const rowH = new Array(rows).fill(defH);
  cards.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    colW[col] = Math.max(colW[col], (c.w ?? cw));
    rowH[row] = Math.max(rowH[row], (c.h ?? defH));
  });

  const colX = [0];
  for (let c = 1; c < cols; c++) colX[c] = colX[c - 1] + colW[c - 1] + GAP;
  const rowY = [0];
  for (let r = 1; r < rows; r++) rowY[r] = rowY[r - 1] + rowH[r - 1] + GAP;

  const totalW = colX[cols - 1] + colW[cols - 1];
  const totalH = rowY[rows - 1] + rowH[rows - 1];

  return cards.map((c, i) => ({
    ...c,
    px: colX[i % cols] - totalW / 2 + (c.w ?? cw) / 2,
    py: rowY[Math.floor(i / cols)] - totalH / 2 + (c.h ?? defH) / 2,
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

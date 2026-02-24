import { getCardWidth, CARD_HEIGHT_DEFAULT } from "./constants";
import type { ShinenCard } from "./types";

// ---- Helpers ----

/** Normalize card dimensions to layout defaults (removes manual resize). */
function resetCardSize(c: ShinenCard, cw: number, ch: number): ShinenCard {
  const next = { ...c, px: c.px, py: c.py, z: c.z };
  // Unset custom w/h so ThoughtCard uses getCardWidth() — matching layout math
  if (next.w !== undefined) delete next.w;
  if (next.h !== undefined) delete next.h;
  // Keep internal cw/ch reference consistent (not persisted)
  void cw;
  void ch;
  return next;
}

/**
 * Dev-only: check all card positions for AABB overlap.
 * Logs a console.warn per collision pair (never throws).
 */
export function checkOverlap(cards: ShinenCard[], cw: number, ch: number): void {
  if (process.env.NODE_ENV === "production") return;
  const half_w = cw / 2;
  const half_h = ch / 2;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i];
      const b = cards[j];
      // AABB collision: cards are center-positioned
      if (
        Math.abs(a.px - b.px) < cw - 1 &&
        Math.abs(a.py - b.py) < ch - 1
      ) {
        console.warn(
          `[SHINEN layout overlap] card ${a.id} (${a.px.toFixed(0)},${a.py.toFixed(0)}) ` +
          `overlaps card ${b.id} (${b.px.toFixed(0)},${b.py.toFixed(0)}) — ` +
          `gap needed: ${cw}×${ch}, actual: ${Math.abs(a.px - b.px).toFixed(0)}×${Math.abs(a.py - b.py).toFixed(0)}`,
        );
      }
      void half_w;
      void half_h;
    }
  }
}

// ---- Layout functions ----

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
  const cw = getCardWidth();
  const ch = CARD_HEIGHT_DEFAULT;
  const GAP = 30;

  // Columns: min 1, max n. For small sets use ceil(sqrt), for larger sets
  // consider viewport width if available.
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);

  // Deterministic grid positions — top-left origin, then center the whole grid.
  const cellW = cw + GAP;
  const cellH = ch + GAP;
  const totalW = cols * cellW - GAP; // no trailing gap
  const totalH = rows * cellH - GAP;

  return cards.map((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return resetCardSize(
      {
        ...c,
        px: col * cellW + cw / 2 - totalW / 2,
        py: row * cellH + ch / 2 - totalH / 2,
        z: -80,
      },
      cw,
      ch,
    );
  });
}

export function layoutCircle(cards: ShinenCard[]): ShinenCard[] {
  const n = cards.length;
  if (n === 0) return cards;
  const cw = getCardWidth();
  const ch = CARD_HEIGHT_DEFAULT;

  // Compute minimum radius to prevent overlapping.
  // Cards are placed on an ellipse with horizontal radius `rad` and vertical radius `rad * 0.55`.
  // Adjacent cards on the circumference must not overlap.
  // Arc distance between neighbors ≈ 2π·rad / n (horizontal component).
  // Require that distance ≥ cardDiagonal (conservative).
  const cardDiag = Math.sqrt(cw * cw + ch * ch);
  const minRadFromSpacing = (cardDiag * n) / (2 * Math.PI) * 1.15; // 15% safety margin
  const baseRad = Math.min(380, 100 + n * 22);
  const rad = Math.max(baseRad, minRadFromSpacing);

  return cards.map((c, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return resetCardSize(
      {
        ...c,
        px: Math.cos(a) * rad,
        py: Math.sin(a) * rad * 0.55,
        z: -120 + Math.sin(a) * 80,
      },
      cw,
      ch,
    );
  });
}

export function layoutTiles(cards: ShinenCard[]): ShinenCard[] {
  const n = cards.length;
  if (n === 0) return cards;
  const cw = getCardWidth();
  const ch = Math.round(CARD_HEIGHT_DEFAULT * 0.75);
  const GAP = 30;

  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);

  const cellW = cw + GAP;
  const cellH = ch + GAP;
  const totalW = cols * cellW - GAP;
  const totalH = rows * cellH - GAP;

  return cards.map((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return resetCardSize(
      {
        ...c,
        px: col * cellW + cw / 2 - totalW / 2,
        py: row * cellH + ch / 2 - totalH / 2,
        z: -300,
      },
      cw,
      ch,
    );
  });
}

export function layoutTriangle(cards: ShinenCard[]): ShinenCard[] {
  const n = cards.length;
  if (n === 0) return cards;
  const cw = getCardWidth();
  const ch = CARD_HEIGHT_DEFAULT;

  // Scale triangle so adjacent cards don't overlap.
  const cardDiag = Math.sqrt(cw * cw + ch * ch);
  const perimeterLength = cardDiag * n * 1.1; // 10% safety margin
  const sideLength = perimeterLength / 3;
  const size = Math.max(400, sideLength / (2 * 0.55)); // back-derive from vertex coords

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
    return resetCardSize(
      {
        ...c,
        px: x1 + (x2 - x1) * frac,
        py: y1 + (y2 - y1) * frac,
        z: -200 + Math.sin((i / n) * Math.PI * 2) * 100,
      },
      cw,
      ch,
    );
  });
}

/**
 * Find a non-overlapping position for a new card among existing cards.
 * Uses spiral search outward from a random starting point.
 */
export function findNonOverlappingPosition(
  existingCards: ShinenCard[],
): { px: number; py: number } {
  const cw = getCardWidth() + 20; // gap
  const ch = CARD_HEIGHT_DEFAULT + 20;

  if (existingCards.length === 0) {
    return { px: 0, py: 0 };
  }

  // Start from a position near center, spiral outward
  const startPx = (Math.random() - 0.5) * 200;
  const startPy = (Math.random() - 0.5) * 100;

  const collides = (px: number, py: number) =>
    existingCards.some(
      (c) => Math.abs(c.px - px) < cw && Math.abs(c.py - py) < ch,
    );

  // Try the starting position first
  if (!collides(startPx, startPy)) return { px: startPx, py: startPy };

  // Spiral search: check positions in expanding rings
  for (let ring = 1; ring <= 20; ring++) {
    const stepX = cw * ring;
    const stepY = ch * ring;
    // Check positions around the ring
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue; // only perimeter
        const px = startPx + dx * cw;
        const py = startPy + dy * ch;
        if (!collides(px, py)) return { px, py };
      }
    }
    void stepX;
    void stepY;
  }

  // Fallback: place far away
  return {
    px: existingCards.length * cw,
    py: 0,
  };
}

const LAYOUT_FNS = [layoutScatter, layoutGrid, layoutCircle, layoutTiles, layoutTriangle] as const;

export function applyLayout(name: string, cards: ShinenCard[]): ShinenCard[] {
  const idx = ["scatter", "grid", "circle", "tiles", "triangle"].indexOf(name);
  if (idx < 0) return cards;
  const result = LAYOUT_FNS[idx](cards);

  // Dev-only overlap check for deterministic layouts (skip scatter — intentionally random)
  if (name === "grid" || name === "tiles") {
    const cw = getCardWidth();
    const ch = name === "tiles" ? Math.round(CARD_HEIGHT_DEFAULT * 0.75) : CARD_HEIGHT_DEFAULT;
    checkOverlap(result, cw, ch);
  }

  return result;
}

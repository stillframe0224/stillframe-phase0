/**
 * tunnelLayout.ts — Pure layout functions for tunnel view.
 * Deterministic, non-overlapping card placement with spatial hashing.
 * All layout/collision in world coordinates. Pointer input converted via screenToWorld.
 * Conversion: screen = (world * zoom) + pan
 */

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Camera2D {
  x: number; // pan x
  y: number; // pan y
  zoom: number;
}

export const CARD_DEFAULT_W = 240;
export const CARD_DEFAULT_H = 280;
export const GAP = 40;

// ── Coordinate conversion ──

/** Convert screen pixel coordinates to world coordinates */
export function screenToWorld(
  screenX: number,
  screenY: number,
  cam: Camera2D
): { x: number; y: number } {
  return {
    x: (screenX - cam.x) / cam.zoom,
    y: (screenY - cam.y) / cam.zoom,
  };
}

/** Convert world coordinates to screen pixel coordinates */
export function worldToScreen(
  worldX: number,
  worldY: number,
  cam: Camera2D
): { x: number; y: number } {
  return {
    x: worldX * cam.zoom + cam.x,
    y: worldY * cam.zoom + cam.y,
  };
}

// ── Epsilon ──

export function getEpsilon(): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  return Math.max(1, 0.5 / dpr);
}

// ── AABB overlap ──

export function aabbOverlap(a: Rect, b: Rect, epsilon: number): boolean {
  return (
    a.x < b.x + b.w + epsilon &&
    a.x + a.w + epsilon > b.x &&
    a.y < b.y + b.h + epsilon &&
    a.y + a.h + epsilon > b.y
  );
}

// ── Overlap counting ──

/**
 * Count overlapping pairs among a set of rects.
 * Skips zero-size rects and returns { overlapPairs, zeroSizeCount }.
 */
export function countOverlapPairs(
  positions: Record<string, Position3D>,
  sizes: Map<string, { w: number; h: number }>
): { overlapPairs: number; zeroSizeCount: number } {
  const epsilon = getEpsilon();
  const rects: Rect[] = [];
  let zeroSizeCount = 0;

  for (const [id, pos] of Object.entries(positions)) {
    const size = sizes.get(id);
    if (!size || (size.w === 0 && size.h === 0)) {
      zeroSizeCount++;
      continue;
    }
    rects.push({ x: pos.x, y: pos.y, w: size.w, h: size.h });
  }

  let overlapPairs = 0;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (aabbOverlap(rects[i], rects[j], epsilon)) {
        overlapPairs++;
      }
    }
  }

  return { overlapPairs, zeroSizeCount };
}

// ── Spatial hash helpers ──

interface SpatialHash {
  cellSize: number;
  cells: Map<string, Rect[]>;
}

function createHash(cellSize: number): SpatialHash {
  return { cellSize, cells: new Map() };
}

function hashKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function cellRange(
  rect: Rect,
  cellSize: number
): { minCx: number; minCy: number; maxCx: number; maxCy: number } {
  return {
    minCx: Math.floor(rect.x / cellSize),
    minCy: Math.floor(rect.y / cellSize),
    maxCx: Math.floor((rect.x + rect.w) / cellSize),
    maxCy: Math.floor((rect.y + rect.h) / cellSize),
  };
}

function hashInsert(hash: SpatialHash, rect: Rect): void {
  const { minCx, minCy, maxCx, maxCy } = cellRange(rect, hash.cellSize);
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const key = hashKey(cx, cy);
      const bucket = hash.cells.get(key);
      if (bucket) {
        bucket.push(rect);
      } else {
        hash.cells.set(key, [rect]);
      }
    }
  }
}

function hashQuery(hash: SpatialHash, rect: Rect): Rect[] {
  const { minCx, minCy, maxCx, maxCy } = cellRange(rect, hash.cellSize);
  const seen = new Set<Rect>();
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const bucket = hash.cells.get(hashKey(cx, cy));
      if (bucket) {
        for (const r of bucket) {
          seen.add(r);
        }
      }
    }
  }
  return Array.from(seen);
}

// ── Auto-arrange ──

/**
 * Deterministic non-overlapping layout in world coordinates.
 * Sort card IDs → place row-by-row with stagger → AABB check via spatial hash.
 * Fallback to strict grid after 50 nudge attempts per card.
 * Cards with w=0 && h=0 are excluded with a warning count returned.
 */
export function autoArrange(
  cardSizes: Map<string, { w: number; h: number }>,
  viewW: number,
  viewH: number
): { positions: Record<string, Position3D>; zeroSizeCount: number } {
  const epsilon = getEpsilon();

  // Filter out zero-size cards
  const validIds: string[] = [];
  let zeroSizeCount = 0;
  for (const [id, size] of cardSizes) {
    if (size.w === 0 && size.h === 0) {
      zeroSizeCount++;
      if (zeroSizeCount <= 5) {
        console.warn(`[tunnel] card ${id} has zero size, excluded from layout`);
      }
    } else {
      validIds.push(id);
    }
  }

  // Sort IDs deterministically
  validIds.sort();
  if (validIds.length === 0) return { positions: {}, zeroSizeCount };

  // Compute average card dimensions for cell sizing
  let totalW = 0;
  let totalH = 0;
  for (const id of validIds) {
    const size = cardSizes.get(id)!;
    totalW += size.w;
    totalH += size.h;
  }
  const avgW = totalW / validIds.length;
  const avgH = totalH / validIds.length;
  const cellSize = avgW + GAP;

  const hash = createHash(cellSize);
  const positions: Record<string, Position3D> = {};

  // Starting position with padding
  const padX = GAP;
  const padY = GAP;
  const usableW = Math.max(viewW - padX * 2, avgW + GAP);

  let cursorX = padX;
  let cursorY = padY;
  let rowMaxH = 0;
  let rowIndex = 0;

  for (const id of validIds) {
    const size = cardSizes.get(id)!;
    const cardW = size.w;
    const cardH = size.h;

    // Advance to next row if card doesn't fit
    if (cursorX + cardW > padX + usableW && cursorX > padX) {
      cursorX = padX;
      cursorY += rowMaxH + GAP;
      rowMaxH = 0;
      rowIndex++;
    }

    // Slight stagger: offset odd rows by half-gap
    const staggerX = rowIndex % 2 === 1 ? GAP * 0.5 : 0;

    let candidate: Rect = {
      x: cursorX + staggerX,
      y: cursorY,
      w: cardW,
      h: cardH,
    };

    // Try placement, nudge if overlapping
    let attempts = 0;
    const MAX_NUDGES = 50;
    while (attempts < MAX_NUDGES) {
      const neighbors = hashQuery(hash, candidate);
      const overlapping = neighbors.some((n) =>
        aabbOverlap(candidate, n, epsilon)
      );
      if (!overlapping) break;

      // Nudge right, then wrap to next row
      candidate = { ...candidate, x: candidate.x + cardW + GAP };
      if (candidate.x + cardW > padX + usableW + GAP) {
        candidate = {
          ...candidate,
          x: padX + staggerX,
          y: candidate.y + avgH + GAP,
        };
      }
      attempts++;
    }

    // Fallback: strict grid if nudges exhausted
    if (attempts >= MAX_NUDGES) {
      const cols = Math.max(
        Math.ceil(Math.sqrt(validIds.length)),
        1
      );
      const idx = validIds.indexOf(id);
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      candidate = {
        x: padX + col * (CARD_DEFAULT_W + GAP),
        y: padY + row * (CARD_DEFAULT_H + GAP),
        w: cardW,
        h: cardH,
      };
    }

    hashInsert(hash, candidate);
    positions[id] = { x: candidate.x, y: candidate.y, z: 0 };

    // Advance cursor
    cursorX = candidate.x + cardW + GAP;
    rowMaxH = Math.max(rowMaxH, cardH);
  }

  return { positions, zeroSizeCount };
}

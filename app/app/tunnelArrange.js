/**
 * Pure helpers for deterministic, non-overlapping tunnel arrangement.
 * Kept framework-agnostic so node:test can import without transpilation.
 */

/**
 * @param {string[]} cardIds
 * @param {{ gapX?: number, gapY?: number, offsetX?: number, offsetY?: number }} [opts]
 * @returns {Record<string, {x:number,y:number,z:number}>}
 */
export function arrangeGridNonOverlap(cardIds, opts = {}) {
  const gapX = opts.gapX ?? 280;
  const gapY = opts.gapY ?? 320;
  const offsetX = opts.offsetX ?? 80;
  const offsetY = opts.offsetY ?? 80;
  const cols = Math.max(Math.ceil(Math.sqrt(cardIds.length || 1)), 1);

  /** @type {Record<string, {x:number,y:number,z:number}>} */
  const positions = {};
  for (let i = 0; i < cardIds.length; i++) {
    const id = cardIds[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[id] = { x: offsetX + col * gapX, y: offsetY + row * gapY, z: 0 };
  }
  return positions;
}

/**
 * @param {Record<string, {x:number,y:number,z?:number}>} positions
 * @param {{w:number,h:number}} [size]
 * @returns {number}
 */
export function countOverlapPairs(positions, size = { w: 240, h: 320 }) {
  const ids = Object.keys(positions);
  let pairs = 0;
  for (let i = 0; i < ids.length; i++) {
    const a = positions[ids[i]];
    for (let j = i + 1; j < ids.length; j++) {
      const b = positions[ids[j]];
      const hit =
        a.x < b.x + size.w &&
        a.x + size.w > b.x &&
        a.y < b.y + size.h &&
        a.y + size.h > b.y;
      if (hit) pairs++;
    }
  }
  return pairs;
}

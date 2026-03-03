import type { Projection } from "./types";

/**
 * Flat 2D no-op projection stub — 3D camera removed.
 */
export function proj(px: number, py: number, _z: number, _crx: number, _cry: number): Projection {
  return { sx: px, sy: py, s: 1, z2: 0 };
}

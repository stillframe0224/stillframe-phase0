import { PERSP } from "./constants";
import type { Projection } from "./types";

/**
 * Manual perspective projection — no CSS 3D transforms.
 * Y-axis rotation → X-axis rotation → perspective division.
 */
export function proj(px: number, py: number, z: number, crx: number, cry: number): Projection {
  const rx = (crx * Math.PI) / 180;
  const ry = (cry * Math.PI) / 180;
  const cY = Math.cos(ry), sY = Math.sin(ry);
  const cX = Math.cos(rx), sX = Math.sin(rx);
  const x1 = px * cY - z * sY;
  const z1 = px * sY + z * cY;
  const y1 = py * cX - z1 * sX;
  const z2 = py * sX + z1 * cX;
  const s = PERSP / (PERSP - z2);
  return { sx: x1 * s, sy: y1 * s, s: Math.max(0.15, s), z2 };
}

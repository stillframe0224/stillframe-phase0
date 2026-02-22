import { proj } from "./lib/projection";
import { TILE_GX, TILE_GY, GRID_COLS, GRID_ROWS } from "./lib/constants";
import type { CameraState } from "./lib/types";

const SAND_COUNT = 40;
const SAND_PARTICLES = Array.from({ length: SAND_COUNT }, (_, i) => ({
  id: i,
  px: (Math.random() - 0.5) * 2200,
  py: (Math.random() - 0.5) * 1200,
  z: -250 - Math.random() * 100,
  r: 1 + Math.random() * 2,
  phaseX: Math.random() * Math.PI * 2,
  phaseY: Math.random() * Math.PI * 2,
}));

interface BackgroundProps {
  cam: CameraState;
  zoom: number;
  time: number;
}

export default function Background({ cam, zoom, time }: BackgroundProps) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden" }}>
      <svg
        viewBox="-960 -540 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {/* Horizontal grid lines */}
        {Array.from({ length: GRID_ROWS }, (_, i) => {
          const y = (i - Math.floor(GRID_ROWS / 2)) * TILE_GY;
          const opacity =
            0.08 +
            0.05 * Math.sin(time * 0.00012 + i * 1.3) +
            0.03 * Math.sin(time * 0.00023 + i * 0.7) +
            0.02 * Math.sin(time * 0.00037 + i * 2.1);
          const p1 = proj(-1400, y, -300 + zoom, cam.rx, cam.ry);
          const p2 = proj(1400, y, -300 + zoom, cam.rx, cam.ry);
          return (
            <line
              key={`h${i}`}
              x1={p1.sx}
              y1={p1.sy}
              x2={p2.sx}
              y2={p2.sy}
              stroke={`rgba(0,0,0,${Math.max(0.08, Math.min(0.18, opacity))})`}
              strokeWidth="0.8"
            />
          );
        })}

        {/* Vertical grid lines */}
        {Array.from({ length: GRID_COLS }, (_, i) => {
          const x = (i - Math.floor(GRID_COLS / 2)) * TILE_GX;
          const opacity =
            0.08 +
            0.05 * Math.sin(time * 0.00015 + i * 0.9) +
            0.03 * Math.sin(time * 0.00019 + i * 1.5) +
            0.02 * Math.sin(time * 0.00031 + i * 0.4);
          const p1 = proj(x, -900, -300 + zoom, cam.rx, cam.ry);
          const p2 = proj(x, 900, -300 + zoom, cam.rx, cam.ry);
          return (
            <line
              key={`v${i}`}
              x1={p1.sx}
              y1={p1.sy}
              x2={p2.sx}
              y2={p2.sy}
              stroke={`rgba(0,0,0,${Math.max(0.08, Math.min(0.18, opacity))})`}
              strokeWidth="0.8"
            />
          );
        })}

        {/* Sand particles */}
        {SAND_PARTICLES.map((p) => {
          const driftX = Math.sin(time * 0.00008 + p.phaseX) * 20;
          const driftY = Math.cos(time * 0.00006 + p.phaseY) * 15;
          const pp = proj(p.px + driftX, p.py + driftY, p.z + zoom, cam.rx, cam.ry);
          return (
            <circle
              key={`sand${p.id}`}
              cx={pp.sx}
              cy={pp.sy}
              r={p.r * pp.s}
              fill="rgba(0,0,0,0.025)"
            />
          );
        })}
      </svg>
    </div>
  );
}

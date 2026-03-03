import { TILE_GX, TILE_GY, GRID_COLS, GRID_ROWS } from "./lib/constants";

// Static per-line opacity derived from original phase offsets (time removed — always 0)
const H_OPACITIES = Array.from({ length: GRID_ROWS }, (_, i) =>
  Math.max(0.07, Math.min(0.16,
    0.09 + 0.04 * Math.sin(i * 1.3) + 0.025 * Math.sin(i * 0.7) + 0.015 * Math.sin(i * 2.1)
  ))
);
const V_OPACITIES = Array.from({ length: GRID_COLS }, (_, i) =>
  Math.max(0.07, Math.min(0.16,
    0.09 + 0.04 * Math.sin(i * 0.9) + 0.025 * Math.sin(i * 1.5) + 0.015 * Math.sin(i * 0.4)
  ))
);

export default function Background() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden" }}>
      {/* Radial vignette: lighter center → darker edges for depth without 3D */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(0,0,0,0.06) 100%)",
        pointerEvents: "none",
      }} />
      <svg
        viewBox="-960 -540 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {/* Horizontal grid lines */}
        {Array.from({ length: GRID_ROWS }, (_, i) => {
          const y = (i - Math.floor(GRID_ROWS / 2)) * TILE_GY;
          return (
            <line
              key={`h${i}`}
              x1={-1400}
              y1={y}
              x2={1400}
              y2={y}
              stroke={`rgba(0,0,0,${H_OPACITIES[i]})`}
              strokeWidth="0.9"
            />
          );
        })}

        {/* Vertical grid lines */}
        {Array.from({ length: GRID_COLS }, (_, i) => {
          const x = (i - Math.floor(GRID_COLS / 2)) * TILE_GX;
          return (
            <line
              key={`v${i}`}
              x1={x}
              y1={-900}
              x2={x}
              y2={900}
              stroke={`rgba(0,0,0,${V_OPACITIES[i]})`}
              strokeWidth="0.9"
            />
          );
        })}
      </svg>
    </div>
  );
}

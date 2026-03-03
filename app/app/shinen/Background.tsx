import { TILE_GX, TILE_GY, GRID_COLS, GRID_ROWS } from "./lib/constants";

interface BackgroundProps {
  time?: number;
}

export default function Background({ time = 0 }: BackgroundProps) {
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
          return (
            <line
              key={`h${i}`}
              x1={-1400}
              y1={y}
              x2={1400}
              y2={y}
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
          return (
            <line
              key={`v${i}`}
              x1={x}
              y1={-900}
              x2={x}
              y2={900}
              stroke={`rgba(0,0,0,${Math.max(0.08, Math.min(0.18, opacity))})`}
              strokeWidth="0.8"
            />
          );
        })}
      </svg>
    </div>
  );
}

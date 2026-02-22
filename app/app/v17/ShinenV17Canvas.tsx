"use client";

import { useEffect, useMemo, useState } from "react";

type V17Card = {
  id: string;
  title: string;
  note: string;
  x: number;
  y: number;
  rotate: number;
  phase: number;
  depth: number;
};

interface ShinenV17CanvasProps {
  cards?: V17Card[];
}

export const INITIAL_V17_CARDS: V17Card[] = [
  {
    id: "v17-1",
    title: "Morning capture",
    note: "Grid stays soft while cards stay bright.",
    x: 26,
    y: 44,
    rotate: -5.8,
    phase: 0.1,
    depth: 0,
  },
  {
    id: "v17-2",
    title: "Link fallback",
    note: "When OGP misses, keep momentum with a generated image.",
    x: 50,
    y: 56,
    rotate: 1.4,
    phase: 1.4,
    depth: 1,
  },
  {
    id: "v17-3",
    title: "Pocket thought",
    note: "Every fragment lands as a card with one visual rhythm.",
    x: 74,
    y: 42,
    rotate: 6.2,
    phase: 2.8,
    depth: 2,
  },
];

const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  x: 6 + (i * 37) % 92,
  y: 8 + (i * 29) % 84,
  r: 0.8 + (i % 5) * 0.45,
  phase: i * 0.62,
}));

const FONT_STACK = '"DM Sans", var(--font-dm), system-ui, -apple-system, sans-serif';

export default function ShinenV17Canvas({
  cards = INITIAL_V17_CARDS,
}: ShinenV17CanvasProps) {
  const [clock, setClock] = useState(0);
  const [e2eMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("e2e") === "1";
  });

  useEffect(() => {
    if (e2eMode) {
      setClock(12);
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      setClock(now / 1000);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [e2eMode]);

  const columns = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);
  const rows = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);

  return (
    <div
      data-testid="v17-root"
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "#fdfdfd",
        fontFamily: FONT_STACK,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(1200px 560px at 50% 8%, rgba(0,0,0,0.03), rgba(0,0,0,0) 62%)",
        }}
      />

      <svg
        aria-hidden
        viewBox="0 0 1000 800"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {columns.map((c) => {
          const x = c * 58.8;
          const pulse = e2eMode ? 0.095 : 0.055 + 0.05 * (0.5 + 0.5 * Math.sin(clock * 0.72 + c * 0.34));
          return (
            <line
              key={`v-col-${c}`}
              x1={x}
              y1={0}
              x2={x}
              y2={800}
              stroke="rgba(0,0,0,1)"
              strokeWidth={0.7}
              strokeOpacity={pulse}
            />
          );
        })}
        {rows.map((r) => {
          const y = r * 61.5;
          const pulse = e2eMode ? 0.095 : 0.055 + 0.05 * (0.5 + 0.5 * Math.sin(clock * 0.66 + r * 0.42));
          return (
            <line
              key={`v-row-${r}`}
              x1={0}
              y1={y}
              x2={1000}
              y2={y}
              stroke="rgba(0,0,0,1)"
              strokeWidth={0.7}
              strokeOpacity={pulse}
            />
          );
        })}
      </svg>

      <div aria-hidden style={{ position: "absolute", inset: 0 }}>
        {PARTICLES.map((p) => {
          const driftX = e2eMode ? 0 : Math.sin(clock * 0.34 + p.phase) * 8;
          const driftY = e2eMode ? 0 : Math.cos(clock * 0.28 + p.phase * 0.8) * 6;
          return (
            <span
              key={`particle-${p.id}`}
              style={{
                position: "absolute",
                left: `calc(${p.x}% + ${driftX}px)`,
                top: `calc(${p.y}% + ${driftY}px)`,
                width: p.r * 2,
                height: p.r * 2,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.14)",
                opacity: 0.22,
                pointerEvents: "none",
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 1160,
          margin: "0 auto",
          padding: "22px 24px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            letterSpacing: "0.12em",
            fontSize: 11,
            color: "rgba(0,0,0,0.55)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          V17 Canvas
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            data-testid="v17-arrange-btn"
            style={{
              border: "1px solid rgba(0,0,0,0.2)",
              background: "rgba(255,255,255,0.9)",
              color: "rgba(0,0,0,0.7)",
              borderRadius: 999,
              padding: "8px 14px",
              fontFamily: FONT_STACK,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.01em",
            }}
          >
            Arrange
          </button>
          <button
            type="button"
            data-testid="v17-reset-btn"
            style={{
              border: "1px solid rgba(0,0,0,0.2)",
              background: "rgba(255,255,255,0.9)",
              color: "rgba(0,0,0,0.7)",
              borderRadius: 999,
              padding: "8px 14px",
              fontFamily: FONT_STACK,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.01em",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          height: "calc(100vh - 96px)",
          minHeight: 560,
          perspective: 1200,
        }}
      >
        {cards.map((card) => {
          const floatY = e2eMode ? 0 : Math.sin(clock * 1.03 + card.phase) * 8;
          const tilt = e2eMode ? card.rotate : card.rotate + Math.sin(clock * 0.41 + card.phase) * 0.85;
          return (
            <div
              key={card.id}
              style={{
                position: "absolute",
                left: `${card.x}%`,
                top: `${card.y}%`,
                transform: `translate(-50%, -50%) translateY(${floatY}px) rotate(${tilt}deg)`,
                width: 228,
                height: 286,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: "4px 4px -4px 4px",
                  borderRadius: 14,
                  background: "rgba(0,0,0,0.08)",
                }}
              />
              <div
                data-testid="v17-card-face"
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  borderRadius: 14,
                  border: "1.5px solid rgba(0,0,0,0.30)",
                  background: "#fff",
                  boxShadow: "0 18px 34px -18px rgba(0,0,0,0.22), 0 7px 16px -10px rgba(0,0,0,0.14)",
                  padding: "18px 18px 16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    width: "fit-content",
                    fontSize: 11,
                    borderRadius: 999,
                    padding: "4px 9px",
                    border: "1px solid rgba(0,0,0,0.13)",
                    color: "rgba(0,0,0,0.56)",
                    background: "rgba(255,255,255,0.92)",
                    fontWeight: 600,
                  }}
                >
                  card {card.depth + 1}
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 20,
                      lineHeight: 1.15,
                      color: "rgba(0,0,0,0.86)",
                      fontWeight: 700,
                      fontFamily: '"Cormorant Garamond", var(--font-serif), Georgia, serif',
                    }}
                  >
                    {card.title}
                  </p>
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      color: "rgba(0,0,0,0.58)",
                      fontFamily: FONT_STACK,
                    }}
                  >
                    {card.note}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

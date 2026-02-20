"use client";

/**
 * ZenCan — Pure CSS 3D cylinder.
 * 12 rotated faces, gradient lighting, subtle noise, 30s sway animation.
 * Respects prefers-reduced-motion.
 */

const FACES = 12;
const RADIUS = 60; // translateZ in px
const FACE_WIDTH = 34; // each face width in px
const FACE_HEIGHT = 140;

// Noise via inline SVG data URI (avoid external file)
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

export default function ZenCan() {
  const faces = Array.from({ length: FACES }, (_, i) => {
    const angle = (360 / FACES) * i;
    // Simulate lighting: faces facing "forward" are lighter
    const lightness = 85 + Math.cos((angle * Math.PI) / 180) * 12;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          width: FACE_WIDTH,
          height: FACE_HEIGHT,
          left: "50%",
          top: "50%",
          marginLeft: -FACE_WIDTH / 2,
          marginTop: -FACE_HEIGHT / 2,
          transform: `rotateY(${angle}deg) translateZ(${RADIUS}px)`,
          background: `linear-gradient(180deg, hsl(0,0%,${lightness}%) 0%, hsl(0,0%,${lightness - 6}%) 100%)`,
          backfaceVisibility: "hidden",
          borderLeft: "1px solid rgba(0,0,0,0.03)",
          borderRight: "1px solid rgba(0,0,0,0.03)",
        }}
      />
    );
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "48px 0",
      }}
    >
      <div
        className="zen-can-scene"
        style={{
          perspective: 600,
          width: RADIUS * 2 + FACE_WIDTH,
          height: FACE_HEIGHT,
        }}
      >
        <div
          className="zen-can-body"
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            transformStyle: "preserve-3d",
            animation: "canSway 30s ease-in-out infinite",
          }}
        >
          {faces}
          {/* Noise overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: NOISE_SVG,
              backgroundRepeat: "repeat",
              pointerEvents: "none",
              borderRadius: "50%",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes canSway {
          0%, 100% { transform: rotateY(0deg) rotateX(-5deg); }
          50% { transform: rotateY(180deg) rotateX(-5deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .zen-can-body {
            animation: none !important;
            transform: rotateY(30deg) rotateX(-5deg);
          }
        }
      `}</style>
    </div>
  );
}

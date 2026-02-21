"use client";

import { getCardType } from "@/lib/cardTypes";

interface ThoughtCardProps {
  text: string;
  type: string;
  index: number;
}

/** Monochrome SVG illustrations — paper texture, no color fills */
const svgIllustrations: Record<string, React.ReactNode> = {
  memo: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#fafafa" />
      <rect x="40" y="25" width="60" height="75" rx="3" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <line x1="50" y1="40" x2="90" y2="40" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
      <line x1="50" y1="52" x2="85" y2="52" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
      <line x1="50" y1="64" x2="88" y2="64" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <line x1="50" y1="76" x2="82" y2="76" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      <circle cx="150" cy="55" r="18" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
      <path d="M143 55 L150 48 L157 55 L150 62Z" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
    </svg>
  ),
  idea: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#fafafa" />
      <circle cx="105" cy="50" r="22" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1.5" />
      <path d="M97 46 Q105 24 113 46" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" fill="none" />
      <line x1="105" y1="72" x2="105" y2="88" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <line x1="99" y1="82" x2="111" y2="82" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <circle cx="55" cy="35" r="5" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      <circle cx="162" cy="78" r="8" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#fafafa" />
      <text x="30" y="68" fontSize="52" fill="rgba(0,0,0,0.07)" fontFamily="Georgia, serif">&ldquo;</text>
      <text x="150" y="95" fontSize="52" fill="rgba(0,0,0,0.07)" fontFamily="Georgia, serif">&rdquo;</text>
      <line x1="65" y1="55" x2="145" y2="55" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
      <line x1="72" y1="67" x2="138" y2="67" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
    </svg>
  ),
  task: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#fafafa" />
      <rect x="50" y="30" width="14" height="14" rx="2" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" fill="none" />
      <path d="M53 37 L57 41 L63 33" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <line x1="72" y1="37" x2="148" y2="37" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
      <rect x="50" y="54" width="14" height="14" rx="2" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" fill="none" />
      <line x1="72" y1="61" x2="138" y2="61" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <rect x="50" y="78" width="14" height="14" rx="2" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5" fill="none" />
      <line x1="72" y1="85" x2="128" y2="85" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
    </svg>
  ),
  feeling: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#fafafa" />
      <path d="M20 75 Q50 35 80 68 Q110 100 140 58 Q170 22 200 62" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" fill="none" />
      <circle cx="50" cy="48" r="4" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
      <circle cx="122" cy="82" r="6" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <circle cx="172" cy="42" r="3" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#fafafa" />
      <rect x="55" y="18" width="100" height="76" rx="3" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" fill="none" />
      <rect x="65" y="28" width="80" height="52" rx="1" fill="rgba(0,0,0,0.03)" />
      <circle cx="85" cy="45" r="7" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
      <path d="M65 74 L90 54 L110 68 L130 52 L145 74Z" fill="rgba(0,0,0,0.05)" />
    </svg>
  ),
  fragment: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#fafafa" />
      <path d="M0 88 Q35 78 65 83 Q105 92 145 80 Q182 68 210 78" stroke="rgba(0,0,0,0.08)" strokeWidth="1" fill="none" />
      <path d="M0 98 Q52 88 105 93 Q155 98 210 90" stroke="rgba(0,0,0,0.05)" strokeWidth="1" fill="none" />
      <circle cx="170" cy="38" r="13" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
      <line x1="30" y1="40" x2="90" y2="40" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
      <line x1="40" y1="52" x2="80" y2="52" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
    </svg>
  ),
  dream: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#fafafa" />
      <rect x="60" y="52" width="16" height="38" rx="1" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <rect x="80" y="36" width="16" height="54" rx="1" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
      <rect x="100" y="46" width="16" height="44" rx="1" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      <rect x="120" y="56" width="16" height="34" rx="1" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      <circle cx="132" cy="25" r="7" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
      <path d="M128 25 Q132 19 136 25" stroke="rgba(0,0,0,0.08)" strokeWidth="1" fill="none" />
    </svg>
  ),
};

export default function ThoughtCard({ text, type, index }: ThoughtCardProps) {
  const ct = getCardType(type);

  return (
    /* Slab stack: 2 pseudo-layers via box-shadow offset */
    <div
      className="thought-card"
      style={{
        position: "relative",
        width: 210,
        minWidth: 210,
        boxShadow: "var(--card-slab-shadow, 0 1.8px 0 rgba(0,0,0,0.06), 0 0.9px 0 rgba(0,0,0,0.04))",
        ["--accent-rgb" as string]: ct.accentRgb,
        animationName: "cardPop",
        animationDuration: "0.45s",
        animationTimingFunction: "ease-out",
        animationFillMode: "both",
        animationDelay: `${index * 0.06}s`,
      }}
    >
      <div
        style={{
          borderRadius: 10,
          border: "1.5px solid var(--card-border, rgba(0,0,0,0.12))",
          background: "linear-gradient(to bottom, transparent 55%, rgba(var(--accent-rgb, 120,120,120), 0.07) 100%), var(--paper-bg, #fdfdfd)",
          overflow: "hidden",
          cursor: "default",
          boxShadow: "var(--card-shadow, 0 4px 20px -6px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.05))",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--card-shadow-hover)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "var(--card-shadow, 0 4px 20px -6px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.05))";
        }}
      >
        {/* SVG Illustration (monochrome) */}
        <div style={{ aspectRatio: "7/4", overflow: "hidden", position: "relative", background: "#fafafa" }}>
          {svgIllustrations[type] || svgIllustrations.memo}
        </div>
        {/* Text + type footer */}
        <div style={{ padding: "10px 14px 12px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: "rgba(0,0,0,0.7)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              margin: 0,
              fontFamily: "var(--font-serif-jp), var(--font-serif), 'Cormorant Garamond', Georgia, serif",
            }}
          >
            {text}
          </p>
          {/* Type dot — only the dot gets the accent color; label is monochrome */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: ct.accent,
                boxShadow: `0 0 0 2px ${ct.accent}33`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(0,0,0,0.35)",
                fontFamily: "var(--font-dm)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {type}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

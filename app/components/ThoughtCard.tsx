"use client";

import { getCardType, MONO_SYMBOLS, MONO_ACCENTS } from "@/lib/cardTypes";

interface ThoughtCardProps {
  text: string;
  type: string;
  index: number;
}

const svgIllustrations: Record<string, React.ReactNode> = {
  memo: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#f8f8f8" />
      <rect x="40" y="25" width="60" height="75" rx="4" fill="#ddd" opacity="0.3" />
      <line x1="50" y1="40" x2="90" y2="40" stroke="#ccc" strokeWidth="1.5" opacity="0.5" />
      <line x1="50" y1="50" x2="85" y2="50" stroke="#ccc" strokeWidth="1.5" opacity="0.4" />
      <line x1="50" y1="60" x2="88" y2="60" stroke="#ccc" strokeWidth="1.5" opacity="0.3" />
      <circle cx="145" cy="50" r="20" fill="#ddd" opacity="0.2" />
      <path d="M138 50 L145 43 L152 50 L145 57Z" fill="#ccc" opacity="0.4" />
      <circle cx="160" cy="80" r="8" fill="#ddd" opacity="0.15" />
    </svg>
  ),
  idea: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#f8f8f8" />
      <circle cx="105" cy="50" r="25" fill="#ddd" opacity="0.25" />
      <path d="M95 45 Q105 20 115 45" stroke="#bbb" strokeWidth="2" fill="none" opacity="0.5" />
      <line x1="105" y1="75" x2="105" y2="90" stroke="#bbb" strokeWidth="2" opacity="0.3" />
      <circle cx="55" cy="35" r="6" fill="#ddd" opacity="0.15" />
      <circle cx="160" cy="75" r="10" fill="#ddd" opacity="0.15" />
      <path d="M92 85 L105 80 L118 85" stroke="#bbb" strokeWidth="1.5" opacity="0.3" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#f8f8f8" />
      <text x="35" y="60" fontSize="48" fill="#ccc" opacity="0.4" fontFamily="serif">&ldquo;</text>
      <text x="155" y="90" fontSize="48" fill="#ccc" opacity="0.4" fontFamily="serif">&rdquo;</text>
      <line x1="65" y1="55" x2="145" y2="55" stroke="#bbb" strokeWidth="1" opacity="0.3" />
      <line x1="75" y1="68" x2="135" y2="68" stroke="#bbb" strokeWidth="1" opacity="0.25" />
    </svg>
  ),
  task: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#f8f8f8" />
      <rect x="50" y="30" width="16" height="16" rx="3" stroke="#ccc" strokeWidth="1.5" fill="none" />
      <path d="M54 38 L58 42 L64 34" stroke="#999" strokeWidth="2" fill="none" />
      <line x1="75" y1="38" x2="150" y2="38" stroke="#ccc" strokeWidth="1.5" opacity="0.4" />
      <rect x="50" y="55" width="16" height="16" rx="3" stroke="#ccc" strokeWidth="1.5" fill="none" />
      <line x1="75" y1="63" x2="140" y2="63" stroke="#ccc" strokeWidth="1.5" opacity="0.3" />
      <rect x="50" y="80" width="16" height="16" rx="3" stroke="#ccc" strokeWidth="1.5" fill="none" />
      <line x1="75" y1="88" x2="130" y2="88" stroke="#ccc" strokeWidth="1.5" opacity="0.2" />
      <circle cx="170" cy="45" r="5" fill="#ccc" opacity="0.15" />
      <rect x="162" y="78" width="20" height="16" rx="2" fill="#ccc" opacity="0.1" />
    </svg>
  ),
  feeling: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#f8f8f8" />
      <path d="M20 70 Q50 30 80 65 Q110 100 140 55 Q170 20 200 60" stroke="#ccc" strokeWidth="2" fill="none" opacity="0.5" />
      <circle cx="50" cy="45" r="5" fill="#bbb" opacity="0.3" />
      <circle cx="120" cy="80" r="7" fill="#ccc" opacity="0.25" />
      <circle cx="170" cy="40" r="4" fill="#bbb" opacity="0.2" />
      <circle cx="90" cy="35" r="3" fill="#ccc" opacity="0.2" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#f8f8f8" />
      <rect x="55" y="15" width="100" height="80" rx="2" stroke="#ccc" strokeWidth="1.5" fill="none" opacity="0.4" />
      <rect x="65" y="25" width="80" height="55" rx="1" fill="#ddd" opacity="0.15" />
      <circle cx="85" cy="42" r="8" fill="#bbb" opacity="0.2" />
      <rect x="65" y="100" width="80" height="6" rx="1" fill="#ddd" opacity="0.1" />
    </svg>
  ),
  fragment: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#f8f8f8" />
      <path d="M0 85 Q30 75 60 80 Q100 88 140 78 Q180 68 210 75" fill="#ddd" opacity="0.15" />
      <path d="M0 95 Q50 85 100 90 Q150 95 210 88" fill="#ddd" opacity="0.1" />
      <circle cx="170" cy="35" r="15" fill="#ddd" opacity="0.1" />
      <line x1="30" y1="40" x2="90" y2="40" stroke="#bbb" strokeWidth="1" opacity="0.2" />
      <line x1="40" y1="50" x2="80" y2="50" stroke="#bbb" strokeWidth="1" opacity="0.15" />
    </svg>
  ),
  dream: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#f8f8f8" />
      <rect x="60" y="50" width="18" height="40" rx="1" fill="#ddd" opacity="0.2" />
      <rect x="82" y="35" width="18" height="55" rx="1" fill="#ddd" opacity="0.25" />
      <rect x="104" y="45" width="18" height="45" rx="1" fill="#ddd" opacity="0.2" />
      <rect x="126" y="55" width="18" height="35" rx="1" fill="#ddd" opacity="0.15" />
      <circle cx="130" cy="25" r="8" fill="#bbb" opacity="0.15" />
      <path d="M125 25 Q130 18 135 25" stroke="#bbb" strokeWidth="1" fill="none" opacity="0.3" />
      <circle cx="50" cy="30" r="2" fill="#ddd" opacity="0.3" />
      <circle cx="165" cy="40" r="2" fill="#ddd" opacity="0.3" />
      <circle cx="90" cy="20" r="1.5" fill="#ddd" opacity="0.25" />
    </svg>
  ),
};

export default function ThoughtCard({ text, type, index }: ThoughtCardProps) {
  const ct = getCardType(type);
  const monoAccent = MONO_ACCENTS[type] || "#b0b0b0";
  const monoSymbol = MONO_SYMBOLS[type] || "●";

  return (
    <div
      className="thought-card"
      style={{
        width: 210,
        minWidth: 210,
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.08)",
        borderLeft: `3px solid ${monoAccent}`,
        background: "#ffffff",
        overflow: "hidden",
        cursor: "default",
        transition: "transform 0.2s, box-shadow 0.2s",
        animationName: "cardPop",
        animationDuration: "0.45s",
        animationTimingFunction: "ease-out",
        animationFillMode: "both",
        animationDelay: `${index * 0.06}s`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow =
          "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* SVG Illustration */}
      <div style={{ aspectRatio: "7/4", overflow: "hidden", position: "relative" }}>
        {svgIllustrations[type] || svgIllustrations.memo}
        <span
          style={{
            position: "absolute",
            bottom: 6,
            right: 8,
            fontSize: 9,
            color: "#aaa",
            opacity: 0.5,
            fontFamily: "var(--font-dm)",
            letterSpacing: "0.05em",
          }}
        >
          auto / generated
        </span>
      </div>
      {/* Text */}
      <div style={{ padding: "10px 14px 12px" }}>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "#2a2a2a",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            margin: 0,
          }}
        >
          {text}
        </p>
        <span
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 10,
            fontWeight: 600,
            color: "#777",
            background: "#f0f0f0",
            padding: "2px 8px",
            borderRadius: 999,
            fontFamily: "var(--font-dm)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {monoSymbol} {type}
        </span>
      </div>
    </div>
  );
}

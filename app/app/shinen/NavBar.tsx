import { useRef, useEffect } from "react";
import { TYPES, TAP_TARGET_MIN } from "./lib/constants";
import type { ShinenCard } from "./lib/types";

interface NavBarProps {
  cards: ShinenCard[];
  layoutLabel: string;
  camIsRotated: boolean;
  searchOpen: boolean;
  searchQuery: string;
  onCycleLayout: () => void;
  onResetCamera: () => void;
  onToggleSearch: () => void;
  onSearchChange: (q: string) => void;
  onExport: () => void;
}

export default function NavBar({
  cards,
  layoutLabel,
  camIsRotated,
  searchOpen,
  searchQuery,
  onCycleLayout,
  onResetCamera,
  onToggleSearch,
  onSearchChange,
  onExport,
}: NavBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [searchOpen]);

  return (
    <div
      data-testid="tunnel-hud"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "14px 22px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {/* Logo + title */}
      <div data-testid="j7-logo" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <svg width={36} height={36} viewBox="0 0 80 80">
          <path
            d="M40 14 A26 26 0 1 1 16 48 A26 26 0 0 1 40 14Z"
            fill="none"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="6"
            transform="translate(1.5,1.5)"
          />
          <path
            d="M40 14 A26 26 0 1 1 16 48"
            fill="none"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M16 48 Q20 38 28 34 Q36 30 40 36 Q44 42 40 40"
            fill="none"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="40" cy="40" r="2" fill="rgba(0,0,0,0.4)" />
        </svg>
        <span
          style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 22,
            fontWeight: 500,
            color: "rgba(0,0,0,0.5)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Shinen
        </span>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Type dots */}
        <div style={{ display: "flex", gap: 3 }}>
          {TYPES.slice(0, 8).map((tp, i) => (
            <div
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: cards.some((c) => c.type === i) ? tp.glow : "rgba(0,0,0,0.06)",
              }}
            />
          ))}
        </div>

        {/* Card count */}
        <span style={{ fontSize: 10, color: "rgba(0,0,0,0.15)", fontWeight: 400 }}>{cards.length}</span>

        {/* Search input (inline, animated) */}
        {searchOpen && (
          <input
            ref={inputRef}
            data-testid="search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="search cards…"
            style={{
              width: 160,
              height: TAP_TARGET_MIN,
              padding: "0 10px",
              background: "rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 8,
              fontSize: 11,
              fontFamily: "'DM Sans',sans-serif",
              color: "rgba(0,0,0,0.65)",
              outline: "none",
            }}
          />
        )}

        {/* Export button */}
        <button
          className="tb17"
          data-testid="export-btn"
          onClick={onExport}
          aria-label="Export cards"
          style={{
            background: "rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 8,
            padding: "4px 8px",
            minHeight: TAP_TARGET_MIN,
            minWidth: TAP_TARGET_MIN,
            fontSize: 10,
            fontFamily: "'DM Sans',sans-serif",
            color: "rgba(0,0,0,0.35)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 2v9" />
            <polyline points="4 7 8 11 12 7" />
            <line x1="3" y1="14" x2="13" y2="14" />
          </svg>
        </button>

        {/* ⌘K search toggle button */}
        <button
          className="tb17"
          data-testid="search-btn"
          onClick={onToggleSearch}
          aria-label="Search cards"
          style={{
            background: searchOpen ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.03)",
            border: `1px solid ${searchOpen ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.08)"}`,
            borderRadius: 8,
            padding: "4px 10px",
            minHeight: TAP_TARGET_MIN,
            minWidth: TAP_TARGET_MIN,
            fontSize: 10,
            fontFamily: "'DM Sans',sans-serif",
            color: searchOpen ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <svg
            width={11}
            height={11}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="6.5" cy="6.5" r="4" />
            <line x1="10" y1="10" x2="14" y2="14" />
          </svg>
          <span style={{ opacity: 0.35, fontSize: 9 }}>⌘K</span>
        </button>

        {/* Layout button */}
        <button
          className="tb17"
          data-testid="layout-pill"
          onClick={onCycleLayout}
          style={{
            background: "rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 8,
            padding: "4px 10px",
            minHeight: TAP_TARGET_MIN,
            minWidth: TAP_TARGET_MIN,
            fontSize: 10,
            fontFamily: "'DM Sans',sans-serif",
            color: "rgba(0,0,0,0.35)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <svg
            width={11}
            height={11}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="10" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="10" width="5" height="5" rx="1" />
            <rect x="10" y="10" width="5" height="5" rx="1" />
          </svg>
          {layoutLabel} <span style={{ opacity: 0.35, fontSize: 9 }}>A</span>
        </button>

        {/* Reset button */}
        <button
          className="tb17"
          data-testid="reset-btn"
          onClick={onResetCamera}
          style={{
            background: "rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 8,
            padding: "4px 10px",
            minHeight: TAP_TARGET_MIN,
            minWidth: TAP_TARGET_MIN,
            fontSize: 10,
            fontFamily: "'DM Sans',sans-serif",
            color: "rgba(0,0,0,0.35)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            opacity: camIsRotated ? 1 : 0,
            pointerEvents: camIsRotated ? "auto" : "none",
            transition: "opacity 0.3s",
          }}
        >
          <svg
            width={11}
            height={11}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 8a6 6 0 0 1 10.5-4" />
            <path d="M14 8a6 6 0 0 1-10.5 4" />
            <polyline points="2 4 2 8 6 8" />
            <polyline points="14 12 14 8 10 8" />
          </svg>
          reset <span style={{ opacity: 0.35, fontSize: 9 }}>R</span>
        </button>
      </div>
    </div>
  );
}

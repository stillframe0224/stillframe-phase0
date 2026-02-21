"use client";

import { useRef, useEffect, useState, type ReactNode, type CSSProperties } from "react";

/**
 * CardShell — SSOT card "shell" for v17 parity.
 *
 * Handles:
 * - White card, subtle border, radius, shadow (SSOT tokens)
 * - Hover: lift -2px + shadow intensify + border darken
 * - Active (pointer down): push +1px + shadow soften
 * - Idle float: gentle ±3px sine at 12s period, phase-shifted per card
 * - prefers-reduced-motion: float disabled
 * - Float pauses on hover/drag
 */

interface CardShellProps {
  children: ReactNode;
  /** Seed for phase-shifting the idle float (0–1 or index) */
  seed?: number;
  /** Enable hover/active interactions */
  interactive?: boolean;
  /** Bulk-selection highlight */
  selected?: boolean;
  /** Click handler (bulk mode) */
  onClick?: () => void;
  /** Pointer down handler (for drag initiation) */
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  /** Card entry animation delay (seconds) */
  animationDelay?: number;
  /** External drag style from dnd-kit (contains transform/transition/opacity) */
  dragStyle?: CSSProperties;
  /** Is the card currently being dragged? */
  isDragging?: boolean;
  /** Additional className */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** data-testid */
  "data-testid"?: string;
  /** Forward ref callback */
  nodeRef?: (node: HTMLDivElement | null) => void;
  /** Mouse enter handler */
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  /** Mouse leave handler */
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
}

export default function CardShell({
  children,
  seed = 0,
  interactive = true,
  selected = false,
  onClick,
  onPointerDown,
  animationDelay = 0,
  dragStyle,
  isDragging = false,
  className,
  style,
  nodeRef,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: CardShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isE2E, setIsE2E] = useState(false);

  // Check prefers-reduced-motion + E2E mode (disable animation for test stability)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    // Detect E2E mode — Playwright tests use ?e2e=1 and animations cause element instability
    try {
      setIsE2E(new URLSearchParams(window.location.search).has("e2e"));
    } catch { /* SSR safe */ }
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Idle float: pause on hover, drag, reduced-motion, or E2E test mode
  const shouldFloat = interactive && !hovered && !isDragging && !pressed && !prefersReducedMotion && !isE2E;

  // Phase offset derived from seed (spread across animation period)
  const phaseOffset = (seed % 17) * 0.73; // ~0–12s range

  // Compute transform: combine drag transform with hover/active/float
  const hoverLift = hovered && interactive ? -2 : 0;
  const activePush = pressed && interactive ? 1 : 0;
  const liftY = hoverLift + activePush;

  const shadow = pressed && interactive
    ? "var(--app-card-shadow-active, 0 8px 14px -4px rgba(0,0,0,0.06))"
    : hovered && interactive
    ? "var(--app-card-shadow-hover, 0 18px 28px -8px rgba(0,0,0,0.10))"
    : "var(--app-card-shadow-idle, 0 11px 18px -5px rgba(0,0,0,0.07))";

  const borderColor = selected
    ? "#4F6ED9"
    : hovered && interactive
    ? "var(--card-border-hover, rgba(0,0,0,0.34))"
    : "var(--app-card-border, rgba(0,0,0,0.30))";

  const shellStyle: CSSProperties = {
    width: "var(--app-card-w, 210px)",
    minWidth: "var(--app-card-w, 210px)",
    borderRadius: "var(--app-card-radius, 10px)",
    border: `var(--app-card-border-w, 1.5px) solid ${borderColor}`,
    background: "var(--app-card-bg, #ffffff)",
    overflow: "hidden",
    cursor: interactive ? (isDragging ? "grabbing" : "default") : "default",
    position: "relative",
    boxShadow: shadow,
    // Float animation (applied via wrapper, not here—see below)
    transform: liftY !== 0 ? `translateY(${liftY}px)` : undefined,
    transition: "box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease",
    // Entry animation
    animationName: "cardPop",
    animationDuration: "0.45s",
    animationTimingFunction: "ease-out",
    animationFillMode: "both",
    animationDelay: `${animationDelay}s`,
    ...dragStyle,
    ...style,
  };

  // Float wrapper — separate from shell to avoid conflicting with drag transforms
  const wrapperStyle: CSSProperties = {
    animation: shouldFloat
      ? `idleFloat var(--app-float-period, 12s) ease-in-out ${phaseOffset}s infinite`
      : "none",
  };

  return (
    <div style={wrapperStyle}>
      <div
        ref={(node) => {
          (shellRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (nodeRef) nodeRef(node);
        }}
        className={className}
        onClick={onClick}
        onPointerDown={(e) => {
          if (interactive) setPressed(true);
          onPointerDown?.(e);
        }}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onMouseEnter={(e) => {
          setHovered(true);
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          setHovered(false);
          setPressed(false);
          onMouseLeave?.(e);
        }}
        style={shellStyle}
        data-testid={rest["data-testid"]}
      >
        {children}
      </div>
    </div>
  );
}

"use client";

/**
 * J7Logo — SHINEN brand mark (SSOT)
 * Used in LP header and App HUD.
 * Displays the J7 SVG mark + optional "SHINEN" text.
 */

interface J7LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  dataTestId?: string;
}

export default function J7Logo({ size = 24, showText = true, className, dataTestId }: J7LogoProps) {
  return (
    <span
      className={className}
      data-testid={dataTestId}
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Ghost ring */}
        <path
          d="M40 14 A26 26 0 1 1 16 48 A26 26 0 0 1 40 14Z"
          fill="none"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth="6"
          transform="translate(1.5,1.5)"
        />
        {/* Main arc */}
        <path
          d="M40 14 A26 26 0 1 1 16 48"
          fill="none"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Hook stroke */}
        <path
          d="M16 48 Q20 38 28 34 Q36 30 40 36 Q44 42 40 40"
          fill="none"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx="40" cy="40" r="2" fill="rgba(0,0,0,0.55)" />
      </svg>
      {showText && (
        <span
          style={{
            fontFamily: "var(--font-serif), 'Cormorant Garamond', Georgia, serif",
            fontSize: size * 0.9,
            fontWeight: 600,
            color: "rgba(0,0,0,0.55)",
            letterSpacing: "0.12em",
            lineHeight: 1,
          }}
        >
          SHINEN
        </span>
      )}
    </span>
  );
}

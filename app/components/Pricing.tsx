"use client";

import copy from "@/lib/copy";
import type { Lang } from "@/lib/copy";
import { track } from "@/lib/track";

interface PricingProps {
  lang: Lang;
  gumroadUrl: string;
}

export default function Pricing({ lang, gumroadUrl }: PricingProps) {
  const c = copy.pricing;

  return (
    <section
      style={{
        maxWidth: 440,
        margin: "0 auto",
        background: "#fff",
        borderRadius: 20,
        border: "1px solid #e8e5e0",
        padding: "40px 36px",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 28,
          fontWeight: 400,
          color: "#2a2a2a",
          marginBottom: 24,
        }}
      >
        {c.h2[lang]}
      </h2>
      <div style={{ marginBottom: 24 }}>
        <span
          style={{
            fontSize: 56,
            fontWeight: 300,
            color: "#2a2a2a",
            fontFamily: "var(--font-dm)",
          }}
        >
          {c.price}
        </span>
        <span
          style={{
            fontSize: 18,
            color: "#999",
            fontFamily: "var(--font-dm)",
          }}
        >
          {c.period[lang]}
        </span>
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 28px",
          textAlign: "left",
        }}
      >
        {c.features[lang].map((f) => (
          <li
            key={f}
            style={{
              fontSize: 15,
              color: "#555",
              padding: "6px 0",
              borderBottom: "1px solid #f0ede8",
              fontFamily: "var(--font-dm)",
            }}
          >
            <span style={{ color: "#2D8F50", marginRight: 8 }}>&#10003;</span>
            {f}
          </li>
        ))}
      </ul>
      <a
        href={gumroadUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("checkout_start")}
        style={{
          display: "inline-block",
          background: "#2a2a2a",
          color: "#fff",
          fontFamily: "var(--font-dm)",
          fontSize: 15,
          fontWeight: 500,
          padding: "12px 32px",
          borderRadius: 999,
          textDecoration: "none",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#444")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#2a2a2a")}
      >
        {c.cta[lang]}
      </a>
    </section>
  );
}

"use client";

import copy from "@/lib/copy";
import type { Lang } from "@/lib/copy";
import { track } from "@/lib/track";
import { PrimaryButton } from "@/ui/components/ui";

interface PricingProps {
  lang: Lang;
  gumroadUrl: string;
}

export default function Pricing({ lang, gumroadUrl }: PricingProps) {
  const c = copy.pricing;
  const hasCheckoutUrl = Boolean(gumroadUrl && gumroadUrl !== "#");

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
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: "#8a5a00",
          fontFamily: "var(--font-dm)",
          background: "#fff4da",
          border: "1px solid #f3dfb3",
          borderRadius: 999,
          padding: "6px 12px",
          display: "inline-block",
        }}
      >
        {c.urgency[lang]}
      </p>
      {hasCheckoutUrl ? (
        <a
          href={gumroadUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track("checkout_start", {
              lang,
              source: "pricing_card",
            })
          }
          data-testid="cta-pricing"
          aria-label={c.cta[lang]}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D9A441] rounded-full"
          style={{ textDecoration: "none" }}
        >
          <PrimaryButton data-testid="cta-pricing" className="rounded-full px-8 py-3 text-sm">
            {c.cta[lang]}
          </PrimaryButton>
        </a>
      ) : (
        <PrimaryButton
          data-testid="cta-pricing"
          type="button"
          onClick={() =>
            track("checkout_unavailable", {
              lang,
              source: "pricing_card",
            })
          }
          aria-label={`${c.cta[lang]} (unavailable)`}
          className="rounded-full px-8 py-3 text-sm"
          disabled
          title="Checkout URL is not configured"
        >
          {c.cta[lang]}
        </PrimaryButton>
      )}
    </section>
  );
}

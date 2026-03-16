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
        <>
          <a
            href={gumroadUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("checkout_start")}
            data-testid="cta-pricing"
            aria-label={c.cta[lang]}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-strong)] rounded-full inline-block"
            style={{ textDecoration: "none", width: "100%" }}
          >
            <PrimaryButton
              data-testid="cta-pricing"
              className="rounded-full px-10 py-4 text-base font-semibold w-full transition-transform hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #2D8F50 0%, #238B44 100%)",
                boxShadow: "0 4px 14px rgba(45, 143, 80, 0.4)",
              }}
            >
              {c.cta[lang]}
            </PrimaryButton>
          </a>
          {/* Trust badges */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
              fontSize: 12,
              color: "#888",
              fontFamily: "var(--font-dm)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="m10.97 4.97-.02.022-3.473 4.425-2.093-2.094a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
              </svg>
              {lang === "en" ? "30-day money back" : "30日間返金保証"}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z"/>
                <path d="M10.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0z"/>
              </svg>
              {lang === "en" ? "Secure payment" : "安全な決済"}
            </span>
          </div>
          {/* Secondary CTA */}
          <div style={{ marginTop: 20, fontSize: 13, color: "#999" }}>
            <a
              href="#waitlist"
              onClick={() => track("pricing_to_waitlist")}
              style={{
                color: "#666",
                textDecoration: "underline",
                fontFamily: "var(--font-dm)",
              }}
            >
              {lang === "en"
                ? "Not ready? Join the waitlist instead"
                : "今すぐでない？ Waitlistに登録"}
            </a>
          </div>
        </>
      ) : (
        <PrimaryButton
          data-testid="cta-pricing"
          type="button"
          onClick={() => track("checkout_unavailable")}
          aria-label={`${c.cta[lang]} (unavailable)`}
          className="rounded-full px-10 py-4 text-base w-full"
          disabled
          title="Checkout URL is not configured"
        >
          {c.cta[lang]}
        </PrimaryButton>
      )}
    </section>
  );
}

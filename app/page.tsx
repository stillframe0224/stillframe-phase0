"use client";

import { useState, useRef, useEffect } from "react";
import copy from "@/lib/copy";
import type { Lang } from "@/lib/copy";
import { cardTypes } from "@/lib/cardTypes";
import { track } from "@/lib/track";
import ThoughtCard from "@/app/components/ThoughtCard";
import LangToggle from "@/app/components/LangToggle";
import AppHeader from "@/ui/components/AppHeader";
import Pricing from "@/app/components/Pricing";
import Waitlist from "@/app/components/Waitlist";
import TrackEvent from "@/app/components/TrackEvent";
import { PrimaryButton, Card } from "@/ui/components/ui";

const GUMROAD_URL = process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL || "#";
const WAITLIST_POST_URL = process.env.NEXT_PUBLIC_WAITLIST_POST_URL || "";
const WAITLIST_FALLBACK_EMAIL =
  process.env.NEXT_PUBLIC_WAITLIST_FALLBACK_EMAIL || "";

interface Card {
  id: number;
  text: string;
  type: string;
}

const sampleTypes = [
  "memo",
  "idea",
  "quote",
  "task",
  "feeling",
  "image",
  "fragment",
  "dream",
] as const;

function DotDivider() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 6,
        padding: "48px 0",
      }}
    >
      {[0.18, 0.10, 0.06].map((op, i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: `rgba(0,0,0,${op})`,
          }}
        />
      ))}
    </div>
  );
}

/** Karesansui sand-ripple SVG overlay (static decorative) */
function SandRipple() {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        userSelect: "none",
      }}
      viewBox="0 0 1200 400"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* concentric gentle arcs — karesansui sand ripples */}
      <path d="M600 420 Q400 300 200 360 Q0 420 -100 380" stroke="rgba(0,0,0,0.04)" strokeWidth="1.5" />
      <path d="M600 460 Q380 320 160 390 Q-60 460 -140 410" stroke="rgba(0,0,0,0.033)" strokeWidth="1.5" />
      <path d="M600 500 Q360 340 120 420 Q-100 500 -180 440" stroke="rgba(0,0,0,0.025)" strokeWidth="1.5" />
      <path d="M600 420 Q800 300 1000 360 Q1200 420 1300 380" stroke="rgba(0,0,0,0.04)" strokeWidth="1.5" />
      <path d="M600 460 Q820 320 1040 390 Q1260 460 1340 410" stroke="rgba(0,0,0,0.033)" strokeWidth="1.5" />
      <path d="M600 500 Q840 340 1080 420 Q1300 500 1380 440" stroke="rgba(0,0,0,0.025)" strokeWidth="1.5" />
    </svg>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [selectedType, setSelectedType] = useState("memo");
  const [input, setInput] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [nextId, setNextId] = useState(1);
  const [ctaVariant, setCtaVariant] = useState<"default" | "early">("default");
  const inputRef = useRef<HTMLInputElement>(null);
  const demoTracked = useRef(false);

  const toggleLang = () => setLang((l) => (l === "en" ? "ja" : "en"));

  const addCard = () => {
    const text = input.trim();
    if (!text) return;
    setCards((prev) => [...prev, { id: nextId, text, type: selectedType }]);
    setNextId((n) => n + 1);
    setInput("");
    track("card_add", { type: selectedType });
    inputRef.current?.focus();
  };

  const resetCards = () => {
    setCards([]);
    setNextId(1);
  };

  // Track page_view on mount
  useEffect(() => {
    track("page_view");
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const variant = query.get("cta") === "early" ? "early" : "default";
    setCtaVariant(variant);
    track("lp_cta_variant_seen", { variant });
  }, []);

  // Get hero sample cards
  const sampleCards: Card[] = sampleTypes.map((type, i) => ({
    id: i + 100,
    text: copy.cardSamples[type][lang],
    type,
  }));

  const ct = cardTypes.find((t) => t.label === selectedType) || cardTypes[0];
  const heroCtaLabel =
    ctaVariant === "early" ? copy.hero.ctaAlt[lang] : copy.hero.cta[lang];

  return (
    <div
      className="paper-grid-bg"
      data-testid="paper-grid"
      style={{
        minHeight: "100vh",
        fontFamily: "var(--font-dm), system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Karesansui sand-ripple decorative backdrop */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <SandRipple />
      </div>
      {/* Nav */}
      <AppHeader lang={lang} onToggle={toggleLang} byline={copy.nav.byline[lang]} />

      {/* Hero */}
      <section
        style={{
          textAlign: "center",
          padding: "80px 24px 40px",
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontFamily:
              lang === "ja" ? "var(--font-serif-jp)" : "var(--font-serif)",
            fontSize: lang === "ja" ? 34 : 42,
            fontWeight: 400,
            color: "#2a2a2a",
            lineHeight: 1.3,
            marginBottom: 20,
            letterSpacing: "-0.01em",
          }}
        >
          {copy.hero.h1[lang]}
        </h1>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.7,
            color: "#777",
            maxWidth: 540,
            margin: "0 auto 36px",
          }}
        >
          {copy.hero.sub[lang]}
        </p>
        <a
          href="#demo"
          onClick={() => track("hero_cta_click", { variant: ctaVariant })}
          aria-label={heroCtaLabel}
          style={{ textDecoration: "none" }}
        >
          <button
            style={{
              padding: "10px 28px",
              borderRadius: 999,
              border: "1.5px solid rgba(0,0,0,0.75)",
              background: "transparent",
              color: "rgba(0,0,0,0.8)",
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: "0.04em",
              fontFamily: "var(--font-dm), system-ui, sans-serif",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {heroCtaLabel}
          </button>
        </a>
      </section>

      {/* Hero Sample Cards */}
      <section
        style={{
          overflow: "hidden",
          padding: "24px 0 0",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
            padding: "0 24px",
          }}
        >
          {sampleCards.map((card, i) => (
            <ThoughtCard
              key={card.id}
              text={card.text}
              type={card.type}
              index={i}
            />
          ))}
        </div>
      </section>

      <DotDivider />

      {/* Demo Section */}
      <section
        id="demo"
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "0 24px 20px",
          position: "relative",
        }}
      >
        <TrackEvent event="demo_open" />
        <h2
          style={{
            fontFamily:
              lang === "ja" ? "var(--font-serif-jp)" : "var(--font-serif)",
            fontSize: 28,
            fontWeight: 400,
            textAlign: "center",
            color: "#2a2a2a",
            marginBottom: 28,
          }}
        >
          {copy.demo.h2[lang]}
        </h2>

        {/* Type Selector */}
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {cardTypes.map((t) => (
            <button
              key={t.label}
              onClick={() => setSelectedType(t.label)}
              style={{
                padding: "5px 14px",
                borderRadius: 999,
                border: `1.5px solid ${
                  selectedType === t.label ? t.border : "transparent"
                }`,
                background:
                  selectedType === t.label ? t.bg : "transparent",
                color: t.accent,
                opacity: selectedType === t.label ? 1 : 0.45,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-dm)",
                cursor: "pointer",
                transition: "all 0.15s",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCard()}
            placeholder={copy.demo.placeholder[lang]}
            style={{
              flex: 1,
              padding: "14px 20px",
              borderRadius: 20,
              border: "1px solid #e8e5e0",
              fontSize: 15,
              fontFamily: "var(--font-dm)",
              background: "#fff",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = ct.border)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e5e0")}
          />
          <button
            onClick={addCard}
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "none",
              background: ct.accent,
              color: "#fff",
              fontSize: 22,
              fontWeight: 300,
              cursor: "pointer",
              transition: "opacity 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            +
          </button>
        </div>

        {/* Cards Grid */}
        {cards.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              {cards.map((card, i) => (
                <ThoughtCard
                  key={card.id}
                  text={card.text}
                  type={card.type}
                  index={i}
                />
              ))}
            </div>
            <div style={{ textAlign: "center" }}>
              <button
                onClick={resetCards}
                style={{
                  fontSize: 13,
                  color: "#999",
                  background: "transparent",
                  border: "1px solid #ddd",
                  borderRadius: 999,
                  padding: "6px 18px",
                  cursor: "pointer",
                  fontFamily: "var(--font-dm)",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "#aaa")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "#ddd")
                }
              >
                {copy.demo.reset[lang]}
              </button>
            </div>
          </>
        )}

        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "var(--sh-ink2)",
            marginTop: 20,
            fontFamily: "var(--font-dm)",
          }}
        >
          {copy.demo.note[lang]}
        </p>
      </section>

      <DotDivider />

      {/* How Images Work */}
      <section
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontFamily:
              lang === "ja" ? "var(--font-serif-jp)" : "var(--font-serif)",
            fontSize: 28,
            fontWeight: 400,
            color: "#2a2a2a",
            marginBottom: 36,
          }}
        >
          {copy.howImages.h2[lang]}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 24,
          }}
        >
          {copy.howImages.cols.map((col, i) => (
            <Card
              key={i}
              image={
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.10)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  {["🔗", "📷", "✨"][i]}
                </div>
              }
              title={col.title[lang]}
              body={col.desc[lang]}
              className="text-left"
            />
          ))}
        </div>
      </section>

      <DotDivider />

      {/* Pricing */}
      <section id="pricing" style={{ padding: "0 24px" }}>
        <Pricing lang={lang} gumroadUrl={GUMROAD_URL} />
      </section>

      <DotDivider />

      {/* Waitlist */}
      <section
        style={{
          maxWidth: 540,
          margin: "0 auto",
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontFamily:
              lang === "ja" ? "var(--font-serif-jp)" : "var(--font-serif)",
            fontSize: 28,
            fontWeight: 400,
            color: "#2a2a2a",
            marginBottom: 24,
          }}
        >
          {copy.waitlist.h2[lang]}
        </h2>
        <Waitlist
          lang={lang}
          postUrl={WAITLIST_POST_URL}
          fallbackEmail={WAITLIST_FALLBACK_EMAIL}
        />
      </section>

      <DotDivider />

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "0 24px 60px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 18,
            color: "#2a2a2a",
            marginBottom: 6,
          }}
        >
          {copy.footer.brand}
        </p>
        <p
          style={{
            fontFamily:
              lang === "ja" ? "var(--font-serif-jp)" : "var(--font-serif)",
            fontSize: 14,
            color: "var(--sh-ink2)",
            fontStyle: "italic",
          }}
        >
          {copy.footer.tagline[lang]}
        </p>
      </footer>
    </div>
  );
}

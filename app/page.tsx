"use client";

import { useState, useRef, useEffect } from "react";
import copy from "@/lib/copy";
import type { Lang } from "@/lib/copy";
import { cardTypes } from "@/lib/cardTypes";
import { track } from "@/lib/track";
import ThoughtCard from "@/app/components/ThoughtCard";
import LangToggle from "@/app/components/LangToggle";
import Pricing from "@/app/components/Pricing";
import Waitlist from "@/app/components/Waitlist";
import TrackEvent from "@/app/components/TrackEvent";

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
      {["#F5C882", "#A0B8F5", "#7EDBA0"].map((c) => (
        <div
          key={c}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: c,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [selectedType, setSelectedType] = useState("memo");
  const [input, setInput] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [nextId, setNextId] = useState(1);
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

  // Get hero sample cards
  const sampleCards: Card[] = sampleTypes.map((type, i) => ({
    id: i + 100,
    text: copy.cardSamples[type][lang],
    type,
  }));

  const ct = cardTypes.find((t) => t.label === selectedType) || cardTypes[0];

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "var(--font-dm), system-ui, sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 32px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src="/enso.png"
            width={20}
            height={20}
            alt="enso"
            style={{ display: "block" }}
          />
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 22,
              fontWeight: 600,
              color: "#2a2a2a",
              letterSpacing: "-0.01em",
            }}
          >
            SHINEN
          </span>
          <span
            style={{
              fontFamily: "var(--font-dm)",
              fontSize: 12,
              color: "#bbb",
            }}
          >
            {copy.nav.byline[lang]}
          </span>
        </div>
        <LangToggle lang={lang} onToggle={toggleLang} />
      </nav>

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
          onClick={() => track("hero_cta_click")}
          style={{
            display: "inline-block",
            padding: "12px 28px",
            borderRadius: 999,
            background: "#2a2a2a",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#444")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#2a2a2a")}
        >
          {copy.hero.cta[lang]}
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
            color: "#bbb",
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
            gap: 32,
          }}
        >
          {copy.howImages.cols.map((col, i) => (
            <div key={i}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: ["#FFF8F0", "#EEF2FF", "#F0FFF4"][i],
                  border: `1px solid ${
                    ["#F5C882", "#A0B8F5", "#7EDBA0"][i]
                  }`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  fontSize: 20,
                }}
              >
                {["🔗", "📷", "✨"][i]}
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#2a2a2a",
                  marginBottom: 8,
                  fontFamily: "var(--font-dm)",
                }}
              >
                {col.title[lang]}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "#777",
                  lineHeight: 1.6,
                }}
              >
                {col.desc[lang]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <DotDivider />

      {/* Pricing */}
      <section style={{ padding: "0 24px" }}>
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
            color: "#bbb",
            fontStyle: "italic",
          }}
        >
          {copy.footer.tagline[lang]}
        </p>
      </footer>
    </div>
  );
}

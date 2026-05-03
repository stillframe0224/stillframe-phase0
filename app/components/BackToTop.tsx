"use client";

import { useState, useEffect } from "react";
import copy from "@/lib/copy";
import type { Lang } from "@/lib/copy";

interface BackToTopProps {
  lang: Lang;
}

export default function BackToTop({ lang }: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setVisible(scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!visible) return null;

  const label = lang === "ja" ? "ページの先頭に戻る" : "Back to top";

  return (
    <button
      onClick={scrollToTop}
      aria-label={label}
      title={label}
      data-testid="back-to-top"
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2a2a2a]"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.95)",
        color: "#2a2a2a",
        fontSize: 18,
        fontWeight: 300,
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeInUp 0.3s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(0,0,0,0.9)";
        e.currentTarget.style.color = "#fff";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.95)";
        e.currentTarget.style.color = "#2a2a2a";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
      }}
    >
      ↑
    </button>
  );
}

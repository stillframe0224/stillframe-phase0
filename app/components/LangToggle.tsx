"use client";

import type { Lang } from "@/lib/copy";

interface LangToggleProps {
  lang: Lang;
  onToggle: () => void;
}

export default function LangToggle({ lang, onToggle }: LangToggleProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        fontFamily: "var(--font-dm)",
        fontSize: 13,
        color: "#999",
        background: "transparent",
        border: "1px solid #ddd",
        borderRadius: 999,
        padding: "5px 14px",
        cursor: "pointer",
        transition: "border-color 0.2s, color 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#aaa";
        e.currentTarget.style.color = "#666";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#ddd";
        e.currentTarget.style.color = "#999";
      }}
    >
      {lang === "en" ? "日本語" : "English"}
    </button>
  );
}

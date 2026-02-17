"use client";
/**
 * AppHeader — LP ヘッダー
 * SubframeのPrimaryButtonとNavItemスタイルを流用しつつ、
 * レイアウトは直接制御（TopbarWithRightNavのw-fullがmaxWidthと競合するため）。
 *
 * Props:
 *   lang       — 現在の言語 ("en" | "ja")
 *   onToggle   — 言語切り替えハンドラ
 *   ctaHref    — CTAボタンのリンク先 (default: "#demo")
 *   byline     — ロゴ右の小テキスト (optional)
 */

import React from "react";
import { PrimaryButton } from "@/ui/components/ui";
import LangToggle from "@/app/components/LangToggle";
import type { Lang } from "@/lib/copy";

interface NavLink {
  label: string;
  href: string;
}

const NAV_LINKS_EN: NavLink[] = [
  { label: "Features", href: "#demo" },
  { label: "Pricing", href: "#pricing" },
];

const NAV_LINKS_JA: NavLink[] = [
  { label: "使い方", href: "#demo" },
  { label: "料金", href: "#pricing" },
];

interface AppHeaderProps {
  lang: Lang;
  onToggle: () => void;
  ctaHref?: string;
  byline?: string;
}

export default function AppHeader({
  lang,
  onToggle,
  ctaHref = "#demo",
  byline,
}: AppHeaderProps) {
  const navLinks = lang === "ja" ? NAV_LINKS_JA : NAV_LINKS_EN;
  const ctaLabel = lang === "ja" ? "早期アクセスを取得" : "Get Early Access";

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: 1100,
        margin: "0 auto",
        padding: "16px 24px",
        gap: 16,
      }}
    >
      {/* Left: logo + brand */}
      <a
        href="/"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            background: "#fff",
            border: "1px solid #e5e5e5",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/enso.png"
            width={20}
            height={20}
            alt="enso"
            style={{ display: "block" }}
          />
        </span>
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
        {byline && (
          <span
            style={{
              fontFamily: "var(--font-dm)",
              fontSize: 12,
              color: "#bbb",
            }}
          >
            {byline}
          </span>
        )}
      </a>

      {/* Right: nav links + lang toggle + CTA */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
        }}
      >
        {/* Anchor nav links — Subframe NavItem style */}
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: 14,
              color: "#777",
              fontFamily: "var(--font-dm)",
              transition: "color 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#2a2a2a")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#777")}
          >
            {link.label}
          </a>
        ))}

        {/* Language toggle */}
        <LangToggle lang={lang} onToggle={onToggle} />

        {/* CTA — Subframe PrimaryButton (brand-primary from tailwind.config.cjs) */}
        <a href={ctaHref} style={{ textDecoration: "none", marginLeft: 4 }}>
          <PrimaryButton>{ctaLabel}</PrimaryButton>
        </a>
      </div>
    </nav>
  );
}

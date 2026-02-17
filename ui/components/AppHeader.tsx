"use client";
/**
 * AppHeader — LP ヘッダー
 * SubframeのTopbarWithRightNavをベースに、
 * 左にensoロゴ＋ブランド名、右にアンカーリンク＋LangToggle＋CTAを配置。
 *
 * Props:
 *   lang       — 現在の言語 ("en" | "ja")
 *   onToggle   — 言語切り替えハンドラ
 *   ctaHref    — CTAボタンのリンク先 (default: "#demo")
 *   byline     — ロゴ右の小テキスト (optional)
 */

import React from "react";
import { TopbarWithRightNav, PrimaryButton } from "@/ui/components/ui";
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

  const leftSlot = (
    <a
      href="/"
      style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
  );

  const rightSlot = (
    <>
      {/* Anchor nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {navLinks.map((link) => (
          <TopbarWithRightNav.NavItem key={link.href}>
            <a
              href={link.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                fontSize: 14,
              }}
            >
              {link.label}
            </a>
          </TopbarWithRightNav.NavItem>
        ))}
      </div>

      {/* Language toggle */}
      <LangToggle lang={lang} onToggle={onToggle} />

      {/* CTA */}
      <a href={ctaHref} style={{ textDecoration: "none" }}>
        <PrimaryButton>{ctaLabel}</PrimaryButton>
      </a>
    </>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 8px" }}>
      <TopbarWithRightNav leftSlot={leftSlot} rightSlot={rightSlot} />
    </div>
  );
}

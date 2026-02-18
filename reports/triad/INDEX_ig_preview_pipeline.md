# INDEX: IG Preview Pipeline

## Overview

Instagram投稿URLからカード画像を表示するまでの一連のパイプライン。oEmbed → image-proxy の2段構成で、セキュリティ強化済み（https-only / IG-only headers / SSRF guard）。

## Pipeline

```
AppCard (client)
  │
  ├─ URL入力 → /api/link-preview (oEmbed or OG scraping)
  │                │
  │                └─ thumbnail_url (IG CDN URL)
  │
  └─ 画像表示 → /api/image-proxy?url=<IG CDN URL>
                     │
                     ├─ https-only gate
                     ├─ SSRF check (validateUrl + dnsCheck per hop)
                     ├─ IG allowlist → UA/Accept/Referer 付与
                     ├─ Content-Type image/* 検証
                     └─ → client <img> render
```

## Endpoints

| Endpoint | Purpose |
|---|---|
| `/api/link-preview` | URL → oEmbed/OG metadata 取得（IG投稿→ thumbnail_url 抽出） |
| `/api/image-proxy` | 画像プロキシ（https-only, IG CDN にのみ UA/Accept 付与, SSRF guard） |
| `/api/metrics/preview` | プレビュー成功率メトリクス |

## PR Timeline

| PR | Title | Commit | Merged | Summary |
|---|---|---|---|---|
| [#51](https://github.com/stillframe0224/stillframe-phase0/pull/51) | fix: improve instagram oEmbed preview reliability | `afefd60` | 2026-02-18T20:16:00Z | IG oEmbed の信頼性改善（link-preview 側） |
| [#52](https://github.com/stillframe0224/stillframe-phase0/pull/52) | fix: proxy instagram thumbnails via image-proxy with ig headers | `9e496d7` | 2026-02-18T20:22:13Z | image-proxy に IG 専用ヘッダー追加、AppCard を proxy 経由に |
| [#49](https://github.com/stillframe0224/stillframe-phase0/pull/49) | fix: card drag reorder + memo modal sizing + year date + IG oEmbed | `792ed5e` | 2026-02-18T20:53:36Z | UI統合（DnD/memo/date）+ IG経路保持で main 取り込み |
| [#53](https://github.com/stillframe0224/stillframe-phase0/pull/53) | security: remove image-proxy ref; ig headers only by host | `d233410` | 2026-02-18T20:40:05Z | ref廃止 / https-only / redirect downgrade防止 / IG-only headers |
| [#54](https://github.com/stillframe0224/stillframe-phase0/pull/54) | docs: close out IG image-proxy hardening (triad report) | `6ecb7dd` | 2026-02-18T20:54:14Z | Closeout レポート |

## Verification

Closeout report の Verification Runbook を参照:
→ `reports/triad/20260219_ig_proxy_hardening_closeout.md` § Verification Runbook

## Known Warnings

- `metadata themeColor` deprecation — cosmetic, 将来の viewport export 移行で解消予定

## Status

**CLOSED** — パイプライン安定、セキュリティ強化完了。

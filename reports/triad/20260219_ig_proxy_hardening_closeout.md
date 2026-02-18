# IG Image Proxy Hardening — Closeout Report

## TL;DR

IG画像プロキシを **https-only / IG-only headers / ref廃止** で安全化。PR #51→#52→#53 で段階的に導入し `ae83135` で main 統合完了。

## Background

Instagram CDN画像（`*.cdninstagram.com` / `*.fbcdn.net`）のサムネ/プレビューが不安定だった。原因は CDN 側の Referer/UA 検証。対応として image-proxy に IG 専用ヘッダーを付与し、同時にセキュリティを強化した。

## Changes in main

| 項目 | 内容 |
|---|---|
| `ref` param 廃止 | caller-supplied Referer を完全除去。IG CDN は固定 `Referer: https://www.instagram.com/` のみ |
| https-only | `parsed.protocol !== "https:"` で http/data/file/javascript 等を 400 拒否 |
| redirect downgrade 防止 | リダイレクト先の protocol も `https:` を強制 |
| IG-only headers | `User-Agent` / `Accept` / `Accept-Language` / `Referer` を IG allowlist host のみに付与。非IG は空ヘッダー |
| Content-Type image/* | 既存維持（変更なし） |
| Timeout / redirect再検証 | 既存維持（AbortController 6s、hop毎に validateUrl + dnsCheck） |

## Changed Files

- `app/api/image-proxy/route.ts` — proxy本体（https-only, IG-only headers, ref廃止）
- `app/app/AppCard.tsx` — `&ref=` パラメータ削除
- `app/api/link-preview/route.ts` — IG oEmbed reliability 改善
- `scripts/link_preview_smoke.mjs` — smoke テスト更新

## Provenance

| Artifact | Value |
|---|---|
| main HEAD | `ae83135` |
| PR #51 | `fix: improve instagram oEmbed preview reliability` → `afefd60` (2026-02-18T20:16:00Z) |
| PR #52 | `fix: proxy instagram thumbnails via image-proxy with ig headers` → `9e496d7` (2026-02-18T20:22:13Z) |
| PR #53 | `security: remove image-proxy ref; ig headers only by host` → `d233410` (2026-02-18T20:40:05Z) |
| Merge commit | `ae83135` (PR #53 squash-merge 後の統合) |

### Codex Review Trail

- `20260219_ig_image_proxy_ref_remove_codex.md` — 初回レビュー: **CHANGES** (https未達 / UA全host付与)
- `20260219_ig_image_proxy_ref_remove_codex_rerun.md` — 再レビュー: **CHANGES** (同上)
- `20260219_ig_image_proxy_ref_remove_codex_fix.md` — 修正実装
- `20260219_ig_image_proxy_ref_remove_codex_rerun2.md` — 最終レビュー

## Verification Runbook

```bash
# 1. Confirm main HEAD
git log --oneline -3

# 2. Build
npm run build

# 3. Smoke (existing script)
node scripts/link_preview_smoke.mjs

# 4. https-only check (expect 400 for http)
curl -s -o /dev/null -w '%{http_code}' 'https://<deploy-host>/api/image-proxy?url=http://example.com/img.jpg'
# Expected: 400

# 5. https IG CDN check (expect 200 + image/*)
curl -s -o /dev/null -w '%{http_code}' 'https://<deploy-host>/api/image-proxy?url=https://scontent.cdninstagram.com/v/t51.2885-15/sample.jpg'
# Expected: 200 (if URL is valid) or 502 (if CDN rejects)
```

## Known Warnings

- `metadata themeColor` deprecation warning in `next build` — cosmetic, no functional impact. Will move to `viewport` export in a future PR.

## Status

**CLOSED** — All Codex CHANGES resolved. Hardening merged to main.

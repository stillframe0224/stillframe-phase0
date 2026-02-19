# 20260219 UI Tone Align (Clean Diff)

## 変更ファイル（このPRで触ったもの）
- app/app/tunnel.css
- app/app/page.tsx
- app/page.tsx
- app/globals.css

※ 方針: AppCard / layout はこのPRに含めず別PRに分離。

## 1枚目トーン準拠の変更点
- tunnel.css
  - 背景を白基調トークンへ寄せ (`var(--sh-bg)`)
  - グリッド線を薄い罫線トークンへ寄せ (`var(--sh-line)`)
  - HUDをガラス調トークン (`var(--sh-glass)`) + 薄い境界線 (`var(--sh-line)`) に統一
  - 影/枠線は token (`--sh-shadow-sm`, `--sh-line*`) を参照
- app/app/page.tsx（list）
  - `#bbb` / `#999` の残存箇所を `var(--sh-ink2)` に置換
  - 既存の境界線/影は `--sh-*` token 参照を維持
- app/page.tsx（LP）
  - `#bbb` を `var(--sh-ink2)` に置換
- app/globals.css
  - `--sh-*` をSSOTとして維持（`--sh-bg`, `--sh-ink`, `--sh-ink2`, `--sh-line`, `--sh-line2`, `--sh-paper`, `--sh-shadow*`, `--sh-glass`）

## 機械チェック（再検出）
実行コマンド:
- `rg -n "#0a0a0a|#0A0A0A|background:\\s*black|rgb\\(0,\\s*0,\\s*0\\)|\"#bbb\"|rgba\\(255,255,255,0\\.03\\)" app/app/tunnel.css app/app/page.tsx app/page.tsx app/globals.css || true`
- `rg -n -P "^@import(?! \"tailwindcss\";)" app || true`

結果:
- 黒背景/濃い面/`#bbb`/強グリッド直書き: **0件**
- `@import`: `@import "tailwindcss";` のみ（Tailwind v4仕様、許容）

## build / e2e
- `npm run build`: PASS
- `npx playwright test e2e/smoke.spec.ts`: PASS (5 passed)
- `npx playwright test e2e/tunnel.spec.ts`: PASS (3 passed)

## 分離方針
- `app/app/AppCard.tsx` と `app/layout.tsx` の変更は本PRに含めない（別PRで管理）。

## What
- Align SHINEN UI tone to light ruled-paper tokens across tunnel/list/LP surfaces.

## Why
- Remove residual dark/inline color drift and enforce token-based SSOT.

## How to test
- Run build + smoke/tunnel Playwright suites and verify grep checks are zero.

## Codex: RISKS
- Minor visual nuance changes from literal->token replacement.

## Codex: TESTS
- Build PASS
- Smoke PASS
- Tunnel PASS
- Grep residuals 0

## Codex: EDGE
- Tailwind v4 `@import "tailwindcss";` intentionally retained.

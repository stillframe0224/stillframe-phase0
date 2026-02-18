# OPS RUN CARD — StillFrame Phase0 (Stage3 stable)

## TL;DR（毎日の最短）
- 変更は小さくPR 1本
- Required: smoke が PASS しないとマージ不可
- PRテンプレの Codex（RISKS/TESTS/EDGE）を埋める（codex-review-check で検査）
- squash merge
- PRが無い日も nightly-smoke がJST 03:10に自動で外形監視

---

## SSOT（正本）
- Repo: stillframe0224/stillframe-phase0 (public)
- Deploy: Vercel (stillframe-phase0.vercel.app)
- Required Ruleset: smoke-gate (main)

---

## 必須ゲート（PRごとに見るもの）
### Required（マージ条件）
- smoke: PASS（Required）

### 常設チェック（落ちたら基本マージしない）
- audit: PASS（ProductionにE2Eが紛れたらFAIL）
- build: PASS
- guard: PASS（E2E封印の不変条件）
- deploy-smoke: PASS
- codex-review-check: PASS（PR本文のRISKS/TESTS/EDGEセクション検査）
- Vercel: PASS（Preview/Deploy完了）

（※ UI系チェックがある場合：ui-smoke も PASS を期待）

---

## Stage3 運用（Codexの扱い）
- PRテンプレに Codex: RISKS / TESTS / EDGE を貼る
- codex-review-check が PASS していることを確認

---

## Nightly 監視（PRが無い日でも）
- nightly-smoke: 毎日 JST 03:10 自動実行
- 証拠: nightly_smoke.txt artifact（14日保持）

---

## 失敗時の一次対応（原因切り分け最短）
### smoke / deploy-smoke が落ちた
- まず Actions のログでHTTP status と対象URLを確認
- ローカル再現: `bash scripts/smoke.sh`

### audit が落ちた（最重要）
- Production に E2E が混入している可能性
- Vercel env / GitHub secrets / workflowログを確認
- 原則：E2EをProductionから排除（封印維持）

### guard が落ちた
- E2E封印の不変条件が破れている
- 直すのは"封印ロジック"のみ（他を触らない）

### codex-review-check が落ちた
- PR本文のCodex欄が空/形式不一致
- まずテンプレ欄を埋める（形式を合わせる）
- チェック条件が厳しすぎる場合のみ、最小修正（3夜観察を再開）

### Vercel が落ちた
- Git接続/権限/デプロイ設定を確認（Settings → Git）
- Hobby制約回避のため repo は public を維持

---

## 観察プロトコル（薄積みを守る）
- 新しい仕組みを足したら「3夜観察」
- 1夜=小さいPR 1本
- FAIL時：原因1点だけ最小修正 → 3夜カウントリセット

# CI Guardrails

## 1. codex-review-check: PR本文の見出しルール

`stage3.yml` の `codex-review-check` ジョブは PR 本文に以下の **3つの見出し** が含まれているかを検査する。

```
## Codex: RISKS
## Codex: TESTS
## Codex: EDGE
```

### よくあるミス

| 書き方 | 結果 |
|---|---|
| `## Codex: RISKS` | PASS |
| `## RISKS` | **FAIL** — `Codex: ` プレフィックスが必要 |
| `### Codex: RISKS` | **FAIL** — `## ` (h2) でなければならない |

### `gh pr create --body` を使う場合

テンプレートは自動適用されないため、見出しを手動で含める必要がある。
`.github/pull_request_template.md` からコピーするか、以下を body に含めること:

```markdown
## Codex: RISKS
- (記入)

## Codex: TESTS
- (記入)

## Codex: EDGE
- (記入)
```

---

## 2. Smoke E2E: CI安定方針

### 原則: テストは e2eMode (`?e2e=1`) 経由で実行する

CI 環境では `E2E=1` でビルドされ `__E2E_ALLOWED__` が true になるが、
認証・外部API・Supabase は利用できない。

### Flaky を生む条件（避けるべき）

| 条件 | 理由 |
|---|---|
| `?e2e=1` なしでの `/app` アクセス | auth gate の挙動がローカルとCIで異なる |
| ネットワーク依存（OGP, 外部画像） | CI runner に外部アクセス制限がある場合がある |
| タイミング依存（setTimeout, animation） | CI は遅い場合があり、固定 timeout は flaky |
| `?view=tunnel` を非e2eモードで検証 | auth なしではページ構造が不定 |

### 安定テストの書き方

```typescript
// GOOD: e2eMode を使い、確定的なDOMを検証
await page.goto("/app?e2e=1&view=list");
await expect(page.getByTestId("cards-grid")).toBeVisible();

// BAD: 非e2eで auth gate 依存
await page.goto("/app?view=tunnel");
// → ローカルでは tunnel 表示、CI では auth redirect or 空ページ
```

### 実行コマンド

```bash
npm run test:smoke          # smoke.spec.ts + tunnel.spec.ts
npm run test:e2e            # 全 E2E (guard 除く)
npm run test:e2e:guard      # guard テストのみ
```

---

## 3. CI workflow の rerun と PR 本文変更

### 問題

GitHub Actions の `rerun` は **トリガー時点のイベントペイロード** を再利用する。
PR 本文を修正してから workflow を rerun しても、**修正前の本文で検査される**。

### 回避策

PR 本文を修正した後に CI を再実行したい場合は、**新しい commit を push** する:

```bash
# 最小: 空コミット
git commit --allow-empty -m "chore: trigger CI" && git push

# または: 実際の修正コミットを push（こちらが望ましい）
```

これにより `synchronize` イベントが発火し、最新の PR 本文で `codex-review-check` が実行される。

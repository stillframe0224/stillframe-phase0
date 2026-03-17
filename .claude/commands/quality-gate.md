---
description: 実装完了後の品質ゲート。build・lint・test・セキュリティチェックを一括実行し、コミット可否を判定する。
argument-hint: <対象ブランチまたは空>
---

## Quality Gate — コミット前チェックリスト

このゲートは「実装不良」と「実行環境不足」を分離して判定する。
以下を順に実行し、最後に `complete / retryable / blocked / permanent` のいずれかで判定する。

## 判定クラス（必須）

- `complete`: 実装品質として完了。Build・Security・TestID整合が通り、Unit/E2E Smoke も通過（または妥当なSKIP）。
- `retryable`: 再実行で解消可能。環境不足（例: `AUTH_REQUIRED`）、一時的失敗、前提未準備。
- `blocked`: 方針・仕様・権限などの意思決定不足で進行不能。実装前提が不明確。
- `permanent`: 現方針で進めるべきでない。重大な安全性問題や要件不整合。

### 1. TypeScript Build

```bash
npm run build
```

- 期待: exit 0、エラー0件
- 失敗時: エラー内容を報告

### 2. Lint（存在する場合）

```bash
npm run lint 2>/dev/null || echo "lint script not found — SKIP"
```

- 期待: exit 0 または SKIP
- 失敗時: lint エラーを報告

### 3. Unit Tests（存在する場合）

```bash
npm test 2>/dev/null || echo "test script not found — SKIP"
```

- 期待: exit 0 または SKIP
- 失敗時: 失敗テスト名を報告

### 4. E2E Smoke（存在する場合）

```bash
node scripts/app_ui_smoke.mjs 2>/dev/null || echo "smoke script not found — SKIP"
```

- 判定ルール:
  - exit 0: `✅ pass`
  - 出力に `AUTH_REQUIRED` を含む: `🔁 retryable`（環境制約。実装不良として扱わない）
  - `smoke script not found — SKIP`: `🔁 retryable`
  - 上記以外の失敗（アサーション失敗・実行時エラー）: `❌ fail`

### 5. 変更範囲（scope）妥当性

- 変更が計画スコープ内に収まっているか確認する
- 局所変更（目安: 1〜2ファイル）か、不要な巻き込み差分がないかを確認する
- 確認例: `git diff --name-only`

### 6. セキュリティ基本チェック

- `dangerouslySetInnerHTML` が DOMPurify なしで使われていないか
- `service_role` キーがクライアントコードに露出していないか
- `.env.local` が `.gitignore` に含まれているか

### 7. data-testid 整合性

- 変更したファイルの `data-testid` が `e2e/*.spec.ts` および `scripts/app_ui_smoke.mjs` と整合しているか

## 判定補助ルール（AUTH_REQUIRED時）

- Build + Unit + Scope + Security + TestID が通過し、E2E Smoke が `AUTH_REQUIRED` のみで止まる場合:
  - 最終判定は `🔁 retryable`
  - 併記文: 「実装品質は妥当。認証済み実行環境（storageState など）を準備後に smoke を再実行」

## 出力フォーマット

| チェック | 結果 | 詳細 |
|----------|------|------|
| Build | ✅/❌ | ... |
| Lint | ✅/⏭️ | ... |
| Unit Tests | ✅/⏭️ | ... |
| E2E Smoke | ✅/🔁/❌ | ... |
| Scope | ✅/🔁/❌ | ... |
| Security | ✅/❌ | ... |
| TestID整合 | ✅/❌ | ... |

**最終判定: ✅ complete / 🔁 retryable / ⛔ blocked / 🛑 permanent**

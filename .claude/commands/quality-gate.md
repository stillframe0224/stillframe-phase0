---
description: 実装完了後の品質ゲート。build・lint・test・セキュリティチェックを一括実行し、コミット可否を判定する。
argument-hint: <対象ブランチまたは空>
---

## Quality Gate — コミット前チェックリスト

以下を順に実行し、全てパスした場合のみ「✅ GATE PASSED」と報告してください。
1つでも失敗した場合は「❌ GATE FAILED」と報告し、修正提案を添えてください。

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

- 期待: exit 0 または SKIP
- 失敗時: 失敗箇所を報告

### 5. セキュリティ基本チェック

- `dangerouslySetInnerHTML` が DOMPurify なしで使われていないか
- `service_role` キーがクライアントコードに露出していないか
- `.env.local` が `.gitignore` に含まれているか

### 6. data-testid 整合性

- 変更したファイルの `data-testid` が `e2e/*.spec.ts` および `scripts/app_ui_smoke.mjs` と整合しているか

## 出力フォーマット

| チェック | 結果 | 詳細 |
|----------|------|------|
| Build | ✅/❌ | ... |
| Lint | ✅/⏭️ | ... |
| Unit Tests | ✅/⏭️ | ... |
| E2E Smoke | ✅/⏭️ | ... |
| Security | ✅/❌ | ... |
| TestID整合 | ✅/❌ | ... |

**判定: ✅ GATE PASSED / ❌ GATE FAILED**

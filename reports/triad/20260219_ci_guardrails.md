# CI Guardrails — codex headings + stable smoke + rerun notes

**Date**: 2026-02-19
**Branch**: `chore/20260219-ci-guardrails`
**Trigger**: PR #71 マージ時に露見した3つの再発ポイント

---

## 背景: PR #71 で発生した問題

### 問題1: codex-review-check FAIL
- `gh pr create --body` で `## RISKS` と書いたが、CI は `## Codex: RISKS` を要求
- テンプレートにはプレフィックスがあったが、`--body` で手書きした場合にバイパスされた

### 問題2: smoke E2E の flaky テスト
- `e2e/tunnel.spec.ts` の「非e2eモードでtunnel or auth gate」テストが CI で FAIL
- CI は `E2E=1` ビルドだが `?e2e=1` なしでアクセスすると auth gate 挙動がローカルと異なる

### 問題3: rerun が PR 本文変更を反映しない
- PR 本文を修正後に `gh api .../rerun` しても、旧ペイロードで実行された
- 結果: codex-review-check が修正後の本文を見ずに再度 FAIL

---

## 変更点

### A: codex-review-check の見出しルール固定
| File | Change |
|---|---|
| `.github/pull_request_template.md` | HTML コメントで `## Codex: ` プレフィックス必須を警告 |
| `.github/workflows/stage3.yml` | エラーメッセージに具体的なフォーマット例を追加 |
| `docs/CI.md` (新規) | 見出しルール、よくあるミス、`gh pr create` 時の注意を文書化 |

### B: smoke E2E のCI安定方針
| File | Change |
|---|---|
| `docs/CI.md` (新規) | flaky 条件の箇条書き、安定テストの書き方ガイド |
| `package.json` | `test:smoke` スクリプト追加 (`smoke.spec.ts + tunnel.spec.ts`) |

### C: rerun 反映問題の運用固定
| File | Change |
|---|---|
| `docs/CI.md` (新規) | rerun の仕組み、回避策（空コミット push）を文書化 |

---

## 影響範囲

- **破壊的変更なし**
- テンプレートの変更は HTML コメント追加のみ（既存 PR に影響なし）
- stage3.yml の変更はエラーメッセージのみ（ロジック不変）
- `test:smoke` は新規追加（既存スクリプトに影響なし）

---

## Codex: RISKS
- テンプレートの HTML コメントが一部 Markdown レンダラで表示される可能性 → GitHub では非表示
- `test:smoke` が tunnel.spec.ts を含むため、tunnel テスト追加時にスクリプト更新不要

## Codex: TESTS
- [x] `npm run build` passes
- [x] `npm run test:smoke` passes (smoke 5 + tunnel 3 = 8 tests)
- [x] 既存 CI ワークフローのロジック変更なし（メッセージのみ）

## Codex: EDGE
- `gh pr create --body` でテンプレートをバイパスしても、エラーメッセージが具体的な修正方法を示す
- rerun で本文変更が反映されない場合のワンライナー回避策が文書化済み

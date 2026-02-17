# GUARDS — 自律タスクの禁止事項・完了定義・ガードレール

これらのルールは **チャット記憶に依存せず** このファイルをSOTとして参照すること。
タスク開始前に必ずこのファイルを読み、違反する操作は行わない。

---

## 絶対禁止（DO NOT）

| # | 禁止事項 | 理由 |
|---|---------|------|
| 1 | **main ブランチへの直接 push** | PRレビューを必ず経由する |
| 2 | **`git push --force` / `git reset --hard`** | 他者・CI の変更を破壊する可能性 |
| 3 | **推測でのコード修正** | 読んでいないファイルを変更しない。必ず Read してから Edit |
| 4 | **npm run build を通さないコミット** | ビルド失敗を main に持ち込まない |
| 5 | **環境変数・シークレットをコードにハードコード** | .env.local / Vercel dashboard で管理 |
| 6 | **外部有料API（OpenAI/Anthropic等）の新規追加** | envvar未設定・費用未確認の場合は禁止 |
| 7 | **Supabase schema の直接変更（ALTER TABLE等）** | 必ずSQL migrationファイル経由 |
| 8 | **無限ループ・タイムアウト無しのポーリング** | 必ず上限・タイムアウト付き |
| 9 | **failure_count >= max_failures 時の継続** | 即停止して要約だけ返す |
| 10 | **1タスク > 30分** | タスクは30分以下に分割する |

---

## ブランチ・コミット規約

```
ブランチ名: claude/<short-slug>  または  fix/<slug>  または  feat/<slug>
コミット形式: type: short description
  type = feat / fix / chore / refactor / docs / test
必須フッター: Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**フロー**: 変更が必要 → ブランチ作成 → コミット → push → PR作成 → main直push禁止

---

## 完了定義（DoD: Definition of Done）

タスクが「完了」とみなされるには **全て** を満たすこと：

1. **ビルド通過**: `npm run build` が zero error で通ること
2. **証拠ファイル**: `reports/triad/<task_id>.md` に以下を記載
   - 変更ファイル一覧
   - ビルド結果（exit code）
   - PR URL（変更がある場合）
   - 動作確認の方法・結果
3. **DONE.json 更新**: タスクエントリを `.rwl/DONE.json` に追記
4. **events.jsonl 更新**: 完了イベントを `.rwl/logs/events.jsonl` に追記
5. **PR作成済み**（変更がある場合）: main直pushは禁止

---

## タスク粒度ルール

- **1タスク ≤ 30分**（見積もりを超えたら分割して次のQueueへ）
- 1回の実行で **最大3タスク** まで
- .rwl/Queue にすでに同様のタスクがあれば **重複作成禁止**

---

## 証拠パス

```
reports/triad/<task_id>.md      # タスク証拠（必須）
reports/market_pulse/           # Market Pulseレポート（自動生成）
issues/auto_generated/          # Issue草案（自動生成）
.rwl/DONE.json                  # 完了タスク一覧
.rwl/logs/events.jsonl          # イベントログ
.rwl/Queue/                     # 待機タスク（1ファイル=1タスク）
.rwl/Current/                   # 実行中タスク
.rwl/Done/                      # 完了済みタスク（アーカイブ）
```

---

## failure_count ガード

```
if status.json の failure_count >= max_failures:
    → 新規タスクを作成・実行しない
    → 現状サマリを返して終了
    → ユーザーに手動リセットを促す
       （failure_count を 0 に戻す: .rwl/status.json 編集）
```

---

## タスクJSONスキーマ（.rwl/Queue/<id>.json）

```json
{
  "id": "YYYYMMDD-HHMMSS-<slug>",
  "goal": "タスクの目的（1行）",
  "est_minutes": 20,
  "dod": ["ビルド通過", "証拠ファイル作成", "PR作成"],
  "evidence_paths": ["reports/triad/<id>.md"],
  "created_at": "ISO8601",
  "status": "queue"
}
```

---

## E2Eバイパス セキュリティ不変条件（Invariants）

これらの条件は **将来のコード変更でも絶対に崩してはならない**。
CIの `guard` ジョブが自動的に検出する。

### 4層封印アーキテクチャ

```
Layer 1 (Build-time) : E2E env var は build時にのみ注入 → 本番buildにはE2Eを渡さない
Layer 2 (Runtime)    : __E2E_ALLOWED__ = E2E && (hostname === "localhost" || "127.0.0.1")
Layer 3 (Seal)       : Object.defineProperty writable:false, configurable:false → DevTools上書き不可
Layer 4 (Client)     : e2eMode = __E2E_ALLOWED__ === true && ?e2e=1 → 両条件ANDが必須
```

### 不変条件一覧

| ID | 条件 | CIテスト |
|----|------|---------|
| I-1 | `E2E` env var 未設定 → `__E2E_ALLOWED__` は `false` | `guard-e2e-off.spec.ts` |
| I-2 | `__E2E_ALLOWED__` が `false` → モックカード非表示 | `guard-e2e-off.spec.ts` |
| I-3 | ホスト名は厳密一致のみ（`localhost` or `127.0.0.1`）。サブドメインや部分一致は不可 | `guard-e2e-off.spec.ts` |
| I-4 | バイパス試行時に `console.warn` を発行（封印は維持） | `guard-e2e-off.spec.ts` |
| I-5 | `__E2E_ALLOWED__` は `false` 時も sealed（再代入・再定義不可） | `guard-e2e-off.spec.ts` |
| I-6 | `__E2E_ALLOWED__` が `true` 時も sealed（DevToolsで `false` に戻せない） | `smoke.spec.ts` |

### 意図した例外（ゼロ）

本番環境でE2Eバイパスを開ける手段は**存在しない**。

- Vercel Production に `E2E=1` を設定してもホスト条件（localhost限定）で封印
- `?e2e=1` を本番URLに付けても同上
- DevToolsで `__E2E_ALLOWED__ = true` と打っても `writable:false` で無効
- `Object.defineProperty` で書き換えても `configurable:false` で `TypeError`

### CI job順序（変更禁止）

```
build → guard → smoke
```

`guard` が `smoke` の前提条件（`needs: guard`）。
この順序を変えると「封印が壊れたまま smoke が通過する」状態になるため禁止。

### 将来の変更を行う場合のチェックリスト

変更後、以下を全て満たすこと:

- [ ] `npm run test:e2e:guard` がローカルで通る
- [ ] `npm run test:e2e:ci` がローカルで通る
- [ ] `layout.tsx` の `__E2E_ALLOWED__` の `writable:false, configurable:false` が維持されている
- [ ] ホスト判定が厳密等価（`===`）のまま
- [ ] Vercel Production の env vars に `E2E` が**含まれていない**（定期監査）

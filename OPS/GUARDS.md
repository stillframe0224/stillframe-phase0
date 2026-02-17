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

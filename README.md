# SHINEN — Phase0

**思考をキャプチャするとき、常に画像が付く体験**

Phase0のゴール: LP → Waitlist登録 → 課金意欲の証拠を得る

---

## 🎯 Phase0 OKR

- **KR1**: Waitlist 登録 ≥ 50件
- **KR2**: Gumroad 決済 ≥ 3件（$29 tier）
- **KR3**: DAU ≥ 10（連続7日）
- **KR4**: カード作成数 ≥ 100（全ユーザー合計）

詳細: [ops/GOALS.md](./ops/GOALS.md)

---

## 🚀 Setup

### 必要環境

- Node.js 18+
- npm 9+
- Supabase プロジェクト（認証 + カードストレージ用）

### 初回セットアップ

```bash
# 1. Clone
git clone https://github.com/array0224-cloud/stillframe-phase0.git
cd stillframe-phase0

# 2. Install dependencies
npm install

# 3. 環境変数の設定
cp .env.example .env.local
# .env.local を編集して Supabase URL/Key、Gumroad URL等を設定

# 4. 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開く

---

## 📦 主要コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動（localhost:3000） |
| `npm run build` | 本番ビルド（Vercel deploy前に必須） |
| `npm run start` | 本番サーバー起動（build後） |
| `npm run test:e2e` | E2Eテスト（Playwright） |
| `npm run test:e2e:guard` | E2Eガードチェック（セキュリティ不変条件） |
| `npm run test:smoke` | スモークテスト（smoke.spec.ts, tunnel.spec.ts） |
| `npm run test:unit` | ユニットテスト（Node.js test runner） |
| `npm run market:pulse` | Market Pulse レポート生成 |

---

## 📁 プロジェクト構成

```
stillframe-phase0/
├── app/                    # Next.js App Router
│   ├── page.tsx           # ランディングページ
│   ├── app/               # メインアプリ（認証後）
│   ├── auth/              # 認証コールバック
│   └── api/               # API Routes
├── components/            # React コンポーネント
├── scripts/               # 自動化スクリプト
│   ├── codex-run-notify   # Codex実行 + 通知
│   └── notify_smoke.mjs   # スモークテスト結果通知
├── tools/                 # ツール群
│   └── market_pulse/      # Market Pulse（市場調査自動化）
├── .rwl/                  # 自律タスク管理（Queue/Current/Done）
│   ├── Queue/            # 待機タスク
│   ├── Current/          # 実行中タスク
│   ├── Done/             # 完了タスク
│   ├── DONE.json         # 完了タスク一覧
│   ├── status.json       # failure_count等のステータス
│   └── logs/             # イベントログ
├── ops/                   # 運用ドキュメント
│   ├── GOALS.md          # Phase0ゴール・OKR
│   └── GUARDS.md         # 自律タスクのガードレール
├── reports/               # 生成レポート
│   ├── triad/            # タスク証拠ファイル
│   └── market_pulse/     # Market Pulseレポート
├── issues/                # Issue草案（自動生成）
│   └── auto_generated/
└── e2e/                   # E2Eテスト（Playwright）
```

---

## 🛡️ セキュリティ: E2Eバイパス封印

本番環境では**絶対に**E2Eモックデータを表示しない4層封印アーキテクチャを採用。

詳細: [ops/GUARDS.md](./ops/GUARDS.md)

```bash
# ガード違反がないか確認
npm run test:e2e:guard
```

---

## 🤖 自律タスクシステム

`.rwl/` 配下で自律エージェントがタスクを管理・実行。

### タスクフロー

```
Queue/ → Current/ → Done/
```

- **Queue**: 待機中のタスク（1ファイル = 1タスク）
- **Current**: 実行中のタスク
- **Done**: 完了済みタスク（アーカイブ）

### ガードレール

- main ブランチへの直接 push 禁止
- `npm run build` が通らないコミット禁止
- failure_count >= max_failures で自動停止

詳細: [ops/GUARDS.md](./ops/GUARDS.md)

---

## 📊 Market Pulse

Market Pulse は Hacker News / Dev.to / Reddit 等から痛みポイントを自動収集し、
スコアリングするツール。

```bash
# レポート生成
npm run market:pulse

# 結果
reports/market_pulse/YYYY-MM-DD.md
```

生成されたレポートは LP の訴求改善や Issue 草案作成に活用。

---

## 🔗 リンク

- **運用ドキュメント**: [ops/GOALS.md](./ops/GOALS.md), [ops/GUARDS.md](./ops/GUARDS.md)
- **タスク証拠**: [reports/triad/](./reports/triad/)
- **Market Pulse レポート**: [reports/market_pulse/](./reports/market_pulse/)
- **Issue草案**: [issues/auto_generated/](./issues/auto_generated/)

---

## 📝 License

ISC

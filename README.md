# SHINEN — Phase0

**思考をキャプチャするとき、常に画像が付く体験を提供する**

SHINEN は、あなたの思考をカードとして保存し、それぞれに自動的に画像が添付される thought-capture アプリです。  
Phase0 では LP + 初期ユーザー獲得 + 課金意欲の実証を目指しています。

---

## 🚀 クイックスタート

### 1. リポジトリをクローン

```bash
git clone https://github.com/array0224-cloud/stillframe-phase0.git
cd stillframe-phase0
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example` を `.env.local` にコピーして、必要な値を設定します。

```bash
cp .env.example .env.local
```

**必須の環境変数:**
- `NEXT_PUBLIC_GUMROAD_PRODUCT_URL` — Gumroad 商品URL（課金リンク）
- `NEXT_PUBLIC_WAITLIST_FALLBACK_EMAIL` — Waitlist のフォールバックメール
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase プロジェクトURL（認証・DB）
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase 匿名キー

**オプション:**
- `NEXT_PUBLIC_WAITLIST_POST_URL` — Waitlist データを POST する URL
- `NTFY_*` — プッシュ通知設定（開発用）
- `E2E=1` — E2E テスト用モックモード（localhost のみ有効）

### 4. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

---

## 📦 ビルド・デプロイ

### プロダクションビルド

```bash
npm run build
```

ビルドが成功すると、`.next/` ディレクトリに最適化されたファイルが生成されます。

### ローカルでプロダクション環境を起動

```bash
npm run start
```

### Vercel へのデプロイ

このリポジトリは Vercel で自動デプロイされます。  
`main` ブランチへの push または PR マージ時に自動的に本番環境に反映されます。

**重要:** 本番環境の `.env` に `E2E=1` を**絶対に設定しない**でください（CI で自動チェックされます）。

---

## 🧪 テスト

### ユニットテスト

```bash
npm run test:unit
```

### E2E テスト（Playwright）

```bash
npm run test:e2e
```

CI 環境での実行:

```bash
npm run test:e2e:ci
```

E2E ガード（セキュリティ不変条件チェック）:

```bash
npm run test:e2e:guard
```

スモークテストのみ:

```bash
npm run test:smoke
```

---

## 📂 ディレクトリ構成

```
stillframe-phase0/
├── app/               # Next.js App Router
│   ├── page.tsx       # LP（ランディングページ）
│   ├── app/           # メインアプリ（/app）
│   ├── auth/          # 認証ページ（/auth/login, /auth/callback）
│   └── api/           # API Routes
├── lib/               # ユーティリティ・ロジック
├── ui/                # UI コンポーネント
├── reports/           # レポート・ログ（triad, market_pulse など）
├── ops/               # 運用ドキュメント（GOALS.md, GUARDS.md）
├── .rwl/              # 自律タスク管理（Queue, Current, Done, logs）
├── tools/             # market_pulse など外部ツール
└── scripts/           # ビルド・通知スクリプト
```

---

## 🎯 Phase0 の目標（OKR）

### Objective: LP → 課金意欲の証拠を得る

- **KR1**: Waitlist 登録 ≥ 50件
- **KR2**: Gumroad 決済 ≥ 3件（$29 tier）
- **KR3**: DAU ≥ 10（連続7日）
- **KR4**: カード作成数 ≥ 100（全ユーザー合計）

詳細は [`ops/GOALS.md`](ops/GOALS.md) を参照してください。

---

## 🛡️ ガードレール

自律タスク（nightly cron など）が従うべきルールは [`ops/GUARDS.md`](ops/GUARDS.md) に記載されています。

**禁止事項の例:**
- main ブランチへの直接 push（必ず PR 経由）
- ビルドが通らないコミット
- 推測でのコード修正（必ず Read → Edit）

---

## 🤖 自律タスク（RWL）

`.rwl/` ディレクトリ配下で、夜間に自動実行されるタスクを管理しています。

- `.rwl/Queue/` — 待機中のタスク
- `.rwl/Current/` — 実行中のタスク
- `.rwl/Done/` — 完了済みタスク
- `.rwl/DONE.json` — 全完了タスクのログ
- `.rwl/logs/events.jsonl` — イベントログ

詳細は [`ops/GUARDS.md`](ops/GUARDS.md) を参照してください。

---

## 📊 Market Pulse

`tools/market_pulse/` で HN, Reddit, Dev.to などから痛みポイントを収集・スコアリングします。

```bash
npm run market:pulse
```

結果は `reports/market_pulse/` に保存されます。

---

## 🔗 リンク

- **ドキュメント**: [GOALS.md](ops/GOALS.md), [GUARDS.md](ops/GUARDS.md)
- **リポジトリ**: https://github.com/array0224-cloud/stillframe-phase0
- **Vercel**: 自動デプロイ（main → production）

---

## 📝 ライセンス

ISC

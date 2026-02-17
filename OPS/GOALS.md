# SHINEN — Phase0 Goals

**プロジェクト**: SHINEN（thought-capture app、全カードに画像）
**リポジトリ**: /Users/array0224/stillframe-phase0
**フェーズ**: Phase0（LP + 初期ユーザー獲得 + 課金実証）

---

## 最上位ゴール

思考をキャプチャするとき、常に画像が付く体験を提供し、
Phase0で「痛みのある初期ユーザーが実際に使い、課金意欲を持つ」ことを証明する。

---

## Phase0 OKR

### Objective: LP → 課金意欲の証拠を得る

**KR1**: Waitlist 登録 ≥ 50件
**KR2**: Gumroad 決済 ≥ 3件（$29 tier）
**KR3**: DAU ≥ 10（連続7日）
**KR4**: カード作成数 ≥ 100（全ユーザー合計）

---

## 自律タスクが取り組むべき領域（優先順）

### 1. UX / バグ修正
- カード作成フローのエラー・ローディングの改善
- OGP画像取得の失敗ハンドリング強化
- モバイル対応の不備修正

### 2. LP 改善
- CTAコピーの改善（A/B可能にする）
- Waitlist フォームの動作確認・改善
- Gumroad リンクの目立ちやすさ改善

### 3. 可観測性
- エラーログ強化（Supabase/OGP fetch失敗の追跡）
- カード作成数・エラー率のダッシュボード（簡易でOK）

### 4. Market Pulse 出力活用
- reports/market_pulse/ の上位スコアをLP訴求に反映
- issues/auto_generated/ のIssue草案をIssue化

### 5. 技術的負債
- Next.js build警告の解消
- TypeScriptエラーの解消
- 未使用依存の整理

---

## 制約・前提

- 本番への影響: app/page.tsx / app/app/page.tsx への大規模変更は慎重に
- Supabase schema変更: 必ずSQL migrationファイルを作成
- 外部API: 認証不要 or 既存envvarのもののみ使用
- デプロイ: main push → Vercel自動デプロイ（PRマージ後）

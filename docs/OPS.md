# OPS — SHINEN Operations Runbook

## enso.png 検証 runbook（3ステップ）

### 1. ローカルのみ確認（network不要）
```bash
bash scripts/enso_verify.sh
```
→ PNG signature・sha256(SSOT比較)・サイズ・寸法をチェック。全て✅ならOK。

### 2. URL fetch込み確認（API不要）
```bash
cd /path/to/stillframe-phase0
SKIP_OPENAI=1 bash scripts/run_openai_image_probe.sh
```
→ `reports/triad/openai_image_probe_<ts>.md` に HTTP 200・Content-Type・sha256・local_vs_url_match を記録。

### 3. OpenAI フル probe（APIキー必要）
```bash
OPENAI_API_KEY="sk-..." bash scripts/run_openai_image_probe.sh
```
→ URLとbase64 data URLの両方でOpenAI `/v1/responses` を叩き、エラーの有無を記録。
→ `reports/triad/openai_resp_url_<ts>.json` と `openai_resp_b64_<ts>.json` が証拠ファイル。

---

## SSOT ファイル

| ファイル | 役割 |
|---------|------|
| `public/enso.png` | 本体 |
| `public/enso.png.sha256` | 期待sha256（SSOT） |
| `scripts/enso_verify.sh` | ローカル検証スクリプト |
| `scripts/openai_image_probe.py` | URLフェッチ＋OpenAI API probe |
| `scripts/run_openai_image_probe.sh` | probe実行ラッパー |
| `reports/triad/openai_image_probe_*.md` | 各回のprobe結果 |

---

## sha256 baseline 更新方法

enso.pngを意図的に更新した場合のみ:
```bash
shasum -a 256 public/enso.png | tee public/enso.png.sha256
git add public/enso.png public/enso.png.sha256
git commit -m "chore: update enso.png and sha256 baseline"
```

---

## CI Guard (GitHub Actions)

`public/enso.png` or `public/enso.png.sha256` が変更されると `.github/workflows/enso_guard.yml` が自動実行。

チェック内容:
1. ファイル存在
2. PNG signature (`89504e47...`)
3. sha256 が SSOT (`public/enso.png.sha256`) と一致
4. ファイルサイズ > 10KB (切り詰め防止)

手動で同じチェックを実行:
```bash
bash scripts/enso_verify.sh
```

---

## Subframe Integration

### 一方向 sync ルール（絶対ルール）

```
Subframe editor → `npm run subframe:sync` → ui/subframe/  (生成物)
                                              ↓ import only
                                           ui/components/  (手修正ラッパー)
                                           app/            (ページ実装)
```

- **`ui/subframe/`**: Subframe生成物の出力先。**直接編集禁止**（次のsyncで上書きされる）
- **`ui/components/`**: 手修正はここに書く。Subframeコンポーネントをimportしてラップ
- **`app/components/`**: 既存の手書きコンポーネント（LangToggle, Pricing等）

### sync手順
```bash
# 1. Subframe editorでデザイン変更
# 2. sync実行
npm run subframe:sync

# 3. 生成されたコンポーネントをimportして使う
# import { Button } from "@/ui/subframe/components/Button";
```

### 緊急escape hatch
生成ファイルをどうしても編集する必要がある場合（最終手段）:
```tsx
// @subframe/sync-disable  ← ファイル先頭に追加で以後のsyncから除外
```

### ディレクトリ構造

| パス | 役割 | 編集可否 |
|------|------|---------|
| `ui/subframe/` | Subframe sync出力先 | **禁止** |
| `ui/components/` | 手修正ラッパー | OK |
| `app/components/` | 既存手書きコンポーネント | OK |
| `.subframe/sync.json` | sync設定 | 設定変更時のみ |

### MCP (Claude Code)

`.claude/settings.json` に Subframe MCP サーバーを設定済み:
- `https://mcp.subframe.com/mcp` — コンポーネント/ページ取得
- `https://docs.subframe.com/mcp` — ドキュメント参照

### Tailwind v4 連携

`app/globals.css` で Subframe theme をimportする（初回sync後にコメント解除）:
```css
@import "../ui/subframe/theme.css";
```

---

## hooks 修繕メモ

`.claude/hooks/block_unsafe.py` と `notify.py` はClaude Code worktreeで
`$CLAUDE_PROJECT_DIR` が worktree を指す場合にも、
main repoの `.claude/hooks/` に実体が存在するため、設定ファイル参照が切れない。

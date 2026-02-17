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

## hooks 修繕メモ

`.claude/hooks/block_unsafe.py` と `notify.py` はClaude Code worktreeで
`$CLAUDE_PROJECT_DIR` が worktree を指す場合にも、
main repoの `.claude/hooks/` に実体が存在するため、設定ファイル参照が切れない。

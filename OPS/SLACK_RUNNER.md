# Slack Runner (shinen-runner)

Socket Mode bot for SHINEN Phase0. DMで `ping` → `pong` 応答。

## Setup

### 1. Secrets入力（初回のみ）

```bash
bash scripts/slack_secrets_setup.sh
```

3つのトークンをペーストする（入力は非表示）:
- `SLACK_BOT_TOKEN` — OAuth & Permissions → Bot User OAuth Token (xoxb-...)
- `SLACK_APP_TOKEN` — Basic Information → App-Level Tokens (xapp-..., connections:write)
- `SLACK_SIGNING_SECRET` — Basic Information → App Credentials → Signing Secret

保存先: `~/.config/stillframe/shinen-runner.env` (chmod 600)

### 2. 手動起動

```bash
npm run slack:runner
```

### 3. 動作確認

Slackで **shinen-runner** にDM → `ping` → `pong` が返れば成功。

### 4. 常駐（launchd）

```bash
bash scripts/shinen_runner_launchd.sh install
bash scripts/shinen_runner_launchd.sh start
bash scripts/shinen_runner_launchd.sh status
```

### 5. ログ確認

```bash
bash scripts/shinen_runner_launchd.sh log
```

### 6. 停止

```bash
bash scripts/shinen_runner_launchd.sh stop
```

## よくある問題

| 症状 | 原因 |
|------|------|
| Socket接続で落ちる | xapp に `connections:write` scope がない |
| Bolt初期化で落ちる | `SLACK_SIGNING_SECRET` が未設定 |
| bot_idループ | subtypeチェック漏れ（実装済み） |

## ファイル構成

```
scripts/slack_runner.ts          — Bolt Socket Mode メイン
scripts/slack_secrets_setup.sh   — 秘密情報入力（read -s）
scripts/shinen_runner_start.sh   — env source → tsx exec ラッパー
scripts/shinen_runner_launchd.sh — launchd管理 (install/start/stop/status/log)
launchd/com.stillframe.shinen-runner.plist — LaunchAgent定義
```

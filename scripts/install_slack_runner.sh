#!/bin/bash
set -euo pipefail

ROOT="/Users/array0224/stillframe-phase0"
cd "$ROOT"

mkdir -p "$HOME/.stillframe/slack_runner" "$HOME/Library/LaunchAgents" "$ROOT/.rwl/logs"

ENV_FILE="$HOME/.stillframe/slack_runner/env"
PLIST="$HOME/Library/LaunchAgents/com.stillframe.slack-runner.plist"
STDOUT_LOG="$ROOT/.rwl/logs/slack_runner.out.log"
STDERR_LOG="$ROOT/.rwl/logs/slack_runner.err.log"

read -r -p "SLACK_BOT_TOKEN (xoxb-...): " BOT_TOKEN
read -r -p "SLACK_APP_TOKEN (xapp-...): " APP_TOKEN
read -r -p "SLACK_ALLOWED_USER_IDS (comma-separated, optional): " ALLOWED_IDS

if [ -z "$BOT_TOKEN" ] || [ -z "$APP_TOKEN" ]; then
  echo "SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required." >&2
  exit 1
fi

cat > "$ENV_FILE" <<EOF
SLACK_BOT_TOKEN=${BOT_TOKEN}
SLACK_APP_TOKEN=${APP_TOKEN}
SLACK_ALLOWED_USER_IDS=${ALLOWED_IDS}
STILLFRAME_ROOT=${ROOT}
EOF
chmod 600 "$ENV_FILE"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.stillframe.slack-runner</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>source "$HOME/.stillframe/slack_runner/env" &amp;&amp; exec node "$ROOT/tools/slack_remote/daemon.mjs"</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${STDOUT_LOG}</string>
  <key>StandardErrorPath</key>
  <string>${STDERR_LOG}</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/com.stillframe.slack-runner" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/com.stillframe.slack-runner"

echo "Daemon running"

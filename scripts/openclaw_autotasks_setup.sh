#!/usr/bin/env bash
# ============================================================
# openclaw_autotasks_setup.sh
# SHINEN Phase0 — OpenClaw goal-driven cron セットアップ
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MORNING_PROMPT="$REPO_ROOT/ops/openclaw_prompts/morning.txt"
NIGHTLY_PROMPT="$REPO_ROOT/ops/openclaw_prompts/nightly.txt"
TZ_IANA="Asia/Tokyo"

# ---- カラー出力 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()     { echo -e "${RED}[ERR]${NC} $*" >&2; }

# ============================================================
# ① openclaw gateway の確認
# ============================================================
check_gateway() {
  info "openclaw gateway 確認中..."

  if ! command -v openclaw &>/dev/null; then
    err "openclaw がインストールされていません。"
    echo "  インストール: npm install -g openclaw"
    exit 1
  fi

  local probe_out
  if ! probe_out=$(openclaw gateway status 2>&1); then
    err "openclaw gateway status が失敗しました。"
    echo "$probe_out"
    echo ""
    echo "対処法:"
    echo "  1. openclaw gateway start  — gatewayを起動"
    echo "  2. openclaw gateway status — 状態確認"
    exit 1
  fi

  # RPC probe: ok を確認
  if ! echo "$probe_out" | grep -q "RPC probe: ok"; then
    err "Gateway が応答していません。"
    echo "$probe_out"
    echo ""
    echo "対処法: openclaw gateway start"
    exit 1
  fi

  info "Gateway OK ✓"
}

# ============================================================
# ② プロンプトファイルの確認
# ============================================================
check_prompts() {
  local ok=true
  for f in "$MORNING_PROMPT" "$NIGHTLY_PROMPT"; do
    if [ ! -f "$f" ]; then
      err "プロンプトファイルが見つかりません: $f"
      ok=false
    fi
  done
  if [ "$ok" = "false" ]; then
    exit 1
  fi
  info "Prompt files OK ✓"
}

# ============================================================
# ③ スモーク: 2分後に1回だけ実行するテストジョブ
# ============================================================
smoke_test() {
  info "スモークテスト: 2分後にモーニングプロンプトを1回実行..."
  openclaw cron add \
    --name "market-pulse-smoke-$(date +%s)" \
    --at "2m" \
    --message "$(cat "$MORNING_PROMPT")" \
    --session isolated \
    --delete-after-run \
    --timeout-seconds 300 \
    --tz "$TZ_IANA"
  info "スモークジョブ登録完了。openclaw cron list で確認してください。"
}

# ============================================================
# ④ 本番 cron の登録（朝8:00 JST / 夜23:00 JST）
# ============================================================
register_cron() {
  # 既存の同名ジョブ確認
  local existing
  existing=$(openclaw cron list 2>/dev/null || echo "")

  # Morning: 毎日 08:00 JST = cron "0 8 * * *" @ Asia/Tokyo
  if echo "$existing" | grep -q "shinen-morning-autotasks"; then
    warn "shinen-morning-autotasks は既に登録済みです。スキップします。"
    warn "  更新する場合: openclaw cron rm <ID> して再実行"
  else
    info "朝タスク cron を登録中 (08:00 JST)..."
    openclaw cron add \
      --name "shinen-morning-autotasks" \
      --cron "0 8 * * *" \
      --tz "$TZ_IANA" \
      --message "$(cat "$MORNING_PROMPT")" \
      --session isolated \
      --timeout-seconds 1800 \
      --description "SHINEN Phase0: morning goal-driven task runner (max 3 tasks, 30min each)"
    info "Morning cron 登録完了 ✓"
  fi

  # Nightly: 毎日 23:00 JST = cron "0 23 * * *" @ Asia/Tokyo
  if echo "$existing" | grep -q "shinen-nightly-autotasks"; then
    warn "shinen-nightly-autotasks は既に登録済みです。スキップします。"
    warn "  更新する場合: openclaw cron rm <ID> して再実行"
  else
    info "夜タスク cron を登録中 (23:00 JST)..."
    openclaw cron add \
      --name "shinen-nightly-autotasks" \
      --cron "0 23 * * *" \
      --tz "$TZ_IANA" \
      --message "$(cat "$NIGHTLY_PROMPT")" \
      --session isolated \
      --timeout-seconds 7200 \
      --description "SHINEN Phase0: nightly MVP improvement runner (1 task, max 2h)"
    info "Nightly cron 登録完了 ✓"
  fi

  echo ""
  info "登録済み cron 一覧:"
  openclaw cron list
}

# ============================================================
# ⑤ プロンプトの更新（既存cronを最新ファイルで上書き）
# ============================================================
update_prompts() {
  info "既存の shinen-*-autotasks の message を最新ファイルで更新..."
  local cron_list
  cron_list=$(openclaw cron list --json 2>/dev/null || echo "[]")

  # morning
  local morning_id
  morning_id=$(echo "$cron_list" | python3 -c "
import sys,json
jobs=json.load(sys.stdin)
for j in jobs:
    if j.get('name','')=='shinen-morning-autotasks':
        print(j['id'])
        break
" 2>/dev/null || echo "")

  if [ -n "$morning_id" ]; then
    openclaw cron edit "$morning_id" --message "$(cat "$MORNING_PROMPT")"
    info "Morning prompt updated: $morning_id"
  else
    warn "shinen-morning-autotasks が見つかりません。register を先に実行してください。"
  fi

  # nightly
  local nightly_id
  nightly_id=$(echo "$cron_list" | python3 -c "
import sys,json
jobs=json.load(sys.stdin)
for j in jobs:
    if j.get('name','')=='shinen-nightly-autotasks':
        print(j['id'])
        break
" 2>/dev/null || echo "")

  if [ -n "$nightly_id" ]; then
    openclaw cron edit "$nightly_id" --message "$(cat "$NIGHTLY_PROMPT")"
    info "Nightly prompt updated: $nightly_id"
  else
    warn "shinen-nightly-autotasks が見つかりません。register を先に実行してください。"
  fi
}

# ============================================================
# エントリポイント
# ============================================================
usage() {
  cat <<EOF
Usage: bash scripts/openclaw_autotasks_setup.sh <command>

Commands:
  check      Gateway疎通・プロンプトファイル確認のみ
  smoke      2分後にモーニングプロンプトをテスト実行（1回のみ）
  register   朝8:00/夜23:00のcronを登録（既存があればスキップ）
  update     既存cronのmessageを最新ファイルで更新
  all        check → register（フルセットアップ）

Examples:
  bash scripts/openclaw_autotasks_setup.sh check
  bash scripts/openclaw_autotasks_setup.sh smoke
  bash scripts/openclaw_autotasks_setup.sh register
  bash scripts/openclaw_autotasks_setup.sh all
EOF
}

CMD="${1:-}"
case "$CMD" in
  check)
    check_gateway
    check_prompts
    ;;
  smoke)
    check_gateway
    check_prompts
    smoke_test
    ;;
  register)
    check_gateway
    check_prompts
    register_cron
    ;;
  update)
    check_gateway
    check_prompts
    update_prompts
    ;;
  all)
    check_gateway
    check_prompts
    register_cron
    ;;
  *)
    usage
    exit 1
    ;;
esac

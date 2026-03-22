#!/bin/bash
# FORBIDDEN_GIT_OPS hook — default deny方式
# readonly allowlistに完全一致したものだけ許可、それ以外のgitは全てブロック
# exit 2 = ツール実行キャンセル（Claude Code の仕様）
# exit 0 = 許可

# === Hook Profile Support ===
# STILLFRAME_HOOK_PROFILE: standard (default) | minimal | strict
# STILLFRAME_DISABLED_HOOKS: comma-separated hook names to skip
HOOK_NAME="block-git-ops"
PROFILE="${STILLFRAME_HOOK_PROFILE:-standard}"
DISABLED="${STILLFRAME_DISABLED_HOOKS:-}"

# Check if this hook is disabled
if echo ",$DISABLED," | grep -q ",$HOOK_NAME,"; then
  exit 0
fi

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# git コマンドでなければ即許可
# 「git 」で始まるか、セパレータの後に「git 」があるかだけチェック
# ファイル名中の "git" (block-git-ops.sh等) に誤反応しない
if ! echo "$COMMAND" | grep -qE '(^|[;&|] *)git '; then
  exit 0
fi

# === ALLOWLIST: readonly git のみ許可 ===
ALLOWED_PATTERNS=(
  '^git log\b'
  '^git status\b'
  '^git diff\b'
  '^git show\b'
  '^git branch$'
  '^git branch -[av]'
  '^git remote -v'
  '^git rev-parse\b'
  '^git describe\b'
  '^git tag$'
  '^git tag -l'
  '^git ls-files\b'
  '^git blame\b'
  '^git shortlog\b'
)

# 複合コマンド対策: セパレータで分割して各セグメントを検査
# echo ok && git push のようなケースをブロックする
while IFS= read -r segment; do
  # 空白trim
  trimmed=$(echo "$segment" | sed 's/^[[:space:]]*//')

  # gitコマンドでないセグメントはスキップ（先頭がgitで始まるもののみ対象）
  if ! echo "$trimmed" | grep -qE '^git '; then
    continue
  fi

  # このセグメントがallowlistに一致するか
  segment_allowed=false
  for pattern in "${ALLOWED_PATTERNS[@]}"; do
    if echo "$trimmed" | grep -qE "$pattern"; then
      segment_allowed=true
      break
    fi
  done

  if [ "$segment_allowed" = false ]; then
    if [ "$PROFILE" = "minimal" ]; then
      echo "BLOCKED: $trimmed" >&2
    else
      echo "🛑 BLOCKED: unapproved git command — readonly allowlist以外は禁止: '$trimmed'" >&2
    fi
    exit 2
  fi
done <<< "$(echo "$COMMAND" | sed 's/&&/\n/g; s/||/\n/g' | tr ';&' '\n')"

exit 0

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Prefer git-derived repo root so this works from any CWD in CI.
if command -v git >/dev/null 2>&1 && git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel >/dev/null 2>&1; then
  ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

ZIP_PATH="$ROOT/dist/save-to-shinen.zip"

REQUIRED_FILES=(
  "tools/chrome-extension/save-to-shinen/manifest.json"
  "tools/chrome-extension/save-to-shinen/background.js"
  "tools/chrome-extension/save-to-shinen/icon16.png"
  "tools/chrome-extension/save-to-shinen/icon48.png"
  "tools/chrome-extension/save-to-shinen/icon128.png"
  "tools/chrome-extension/save-to-shinen/INSTALL.md"
  "tools/chrome-extension/save-to-shinen/README.md"
  "tools/chrome-extension/save-to-shinen/TEST.md"
)

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

if ! command -v unzip >/dev/null 2>&1; then
  fail "unzip is required but was not found in PATH"
fi

bash "$ROOT/scripts/package_extension.sh"

if [ ! -f "$ZIP_PATH" ]; then
  fail "Expected ZIP not found: dist/save-to-shinen.zip"
fi

if [ ! -s "$ZIP_PATH" ]; then
  fail "ZIP exists but is empty: dist/save-to-shinen.zip"
fi

echo
echo "ZIP contents:"
unzip -l "$ZIP_PATH"

tmp_list="$(mktemp)"
cleanup() { rm -f "$tmp_list"; }
trap cleanup EXIT

if unzip -Z1 "$ZIP_PATH" >/dev/null 2>&1; then
  unzip -Z1 "$ZIP_PATH" >"$tmp_list"
else
  # Fallback: parse the last column from `unzip -l` output
  unzip -l "$ZIP_PATH" \
    | awk 'BEGIN{in_files=0} /^\s*-+\s*$/{if(!in_files){in_files=1;next}else{exit}} in_files{print $NF}' \
    >"$tmp_list"
fi

# Fail on macOS junk.
if grep -qE '(^|/)__MACOSX(/|$)' "$tmp_list"; then
  fail "ZIP contains __MACOSX entries"
fi
if grep -qE '(^|/)\.DS_Store$' "$tmp_list"; then
  fail "ZIP contains .DS_Store entries"
fi

missing=0
for f in "${REQUIRED_FILES[@]}"; do
  if ! grep -Fxq "$f" "$tmp_list"; then
    echo "Missing required file in ZIP: $f" >&2
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  exit 1
fi

size="$(du -h "$ZIP_PATH" | awk '{print $1}')"
count="$(wc -l <"$tmp_list" | tr -d ' ')"

echo
echo "OK: extension ZIP verified"
echo "  Root: $ROOT"
echo "  Path: dist/save-to-shinen.zip"
echo "  Entries: $count"
echo "  Size: $size"

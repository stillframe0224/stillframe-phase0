#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

if ! command -v gh >/dev/null 2>&1; then
  fail "gh is required but was not found in PATH"
fi

if ! command -v unzip >/dev/null 2>&1; then
  fail "unzip is required but was not found in PATH"
fi

if ! command -v shasum >/dev/null 2>&1; then
  fail "shasum is required but was not found in PATH"
fi

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  VERSION="$(node -p "require('./tools/chrome-extension/save-to-shinen/manifest.json').version" 2>/dev/null || true)"
  if [[ -z "$VERSION" || "$VERSION" == "null" ]]; then
    fail "Could not read manifest version via node"
  fi
  TAG="v$VERSION"
fi

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "Downloading release assets for $TAG ..."
gh release download "$TAG" \
  -p save-to-shinen.zip \
  -p save-to-shinen.zip.sha256 \
  -D "$TMP"

ZIP="$TMP/save-to-shinen.zip"
SHA_FILE="$TMP/save-to-shinen.zip.sha256"

[[ -f "$ZIP" ]] || fail "Missing downloaded asset: save-to-shinen.zip"
[[ -f "$SHA_FILE" ]] || fail "Missing downloaded asset: save-to-shinen.zip.sha256"

echo
echo "ZIP contents:"
unzip -l "$ZIP"

tmp_list="$(mktemp)"
rm_list() { rm -f "$tmp_list"; }
trap 'rm_list; cleanup' EXIT

unzip -Z1 "$ZIP" | tr -d '\r' >"$tmp_list"

# Enforce install-friendly layout: no subdirectories.
if grep -q '/' "$tmp_list"; then
  fail "ZIP contains subdirectory entries (expected all files at ZIP root)"
fi

# Fail on macOS junk.
if grep -qE '(^|/)__MACOSX(/|$)' "$tmp_list"; then
  fail "ZIP contains __MACOSX entries"
fi
if grep -qE '(^|/)\.DS_Store$' "$tmp_list"; then
  fail "ZIP contains .DS_Store entries"
fi

REQUIRED_FILES=(
  "manifest.json"
  "background.js"
  "icon16.png"
  "icon48.png"
  "icon128.png"
  "INSTALL.md"
  "README.md"
  "TEST.md"
)

missing=0
for f in "${REQUIRED_FILES[@]}"; do
  if ! grep -Fxq "$f" "$tmp_list"; then
    echo "Missing required file in ZIP: $f" >&2
    missing=1
  fi
done
[[ "$missing" -eq 0 ]] || exit 1

expected_sha="$(awk '{print $1}' "$SHA_FILE" | tr -d '\r' | head -n 1)"
[[ -n "$expected_sha" ]] || fail "Could not read expected SHA256 from $SHA_FILE"

actual_sha="$(shasum -a 256 "$ZIP" | awk '{print $1}')"
if [[ "$actual_sha" != "$expected_sha" ]]; then
  fail "SHA256 mismatch: expected $expected_sha, got $actual_sha"
fi

zip_size="$(du -h "$ZIP" | awk '{print $1}')"
sha_size="$(du -h "$SHA_FILE" | awk '{print $1}')"
count="$(wc -l <"$tmp_list" | tr -d ' ')"

echo
echo "PASS: release asset audit"
echo "  Tag: $TAG"
echo "  ZIP: $zip_size ($count entries)"
echo "  SHA: $sha_size"


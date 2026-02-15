#!/usr/bin/env bash
set -euo pipefail

# Package Chrome extension for distribution
# Input: tools/chrome-extension/save-to-shinen/
# Output: dist/save-to-shinen.zip

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"
OUTPUT_ZIP="$DIST_DIR/save-to-shinen.zip"

EXT_DIR="tools/chrome-extension/save-to-shinen"

REQUIRED_FILES=(
  "$EXT_DIR/manifest.json"
  "$EXT_DIR/background.js"
  "$EXT_DIR/icon16.png"
  "$EXT_DIR/icon48.png"
  "$EXT_DIR/icon128.png"
  "$EXT_DIR/INSTALL.md"
  "$EXT_DIR/README.md"
  "$EXT_DIR/TEST.md"
)

echo "Packaging Save to SHINEN Chrome Extension..."

for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$REPO_ROOT/$f" ]; then
    echo "Error: required file not found: $f" >&2
    exit 1
  fi
done

mkdir -p "$DIST_DIR"
rm -f "$OUTPUT_ZIP"

# Create a minimal, deterministic zip. Keep the repo-relative paths.
cd "$REPO_ROOT"
zip -X -r "$OUTPUT_ZIP" "${REQUIRED_FILES[@]}" \
  -x "*.DS_Store" \
  -x "__MACOSX*" \
  >/dev/null

# Sanity check.
if ! unzip -Z1 "$OUTPUT_ZIP" 2>/dev/null | grep -qx "$EXT_DIR/manifest.json"; then
  echo "Error: manifest.json not found in ZIP at expected path" >&2
  exit 1
fi

echo "OK: $OUTPUT_ZIP ($(du -h "$OUTPUT_ZIP" | awk '{print $1}'))"

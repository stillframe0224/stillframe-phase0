#!/usr/bin/env bash
set -euo pipefail

# Package Chrome extension for distribution
# Input: tools/chrome-extension/save-to-shinen/
# Output: dist/save-to-shinen.zip

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"
OUTPUT_ZIP="$DIST_DIR/save-to-shinen.zip"

SOURCE_DIR="$REPO_ROOT/tools/chrome-extension/save-to-shinen"

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

echo "Packaging Save to SHINEN Chrome Extension..."

for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$SOURCE_DIR/$f" ]; then
    echo "Error: required file not found: $f" >&2
    exit 1
  fi
done

mkdir -p "$DIST_DIR"
rm -f "$OUTPUT_ZIP"

# Create a minimal, deterministic zip with manifest.json at the ZIP root.
cd "$SOURCE_DIR"
zip -X "$OUTPUT_ZIP" "${REQUIRED_FILES[@]}" >/dev/null

# Sanity check.
if ! unzip -Z1 "$OUTPUT_ZIP" 2>/dev/null | tr -d '\r' | grep -qx "manifest.json"; then
  echo "Error: manifest.json not found in ZIP root" >&2
  exit 1
fi

echo "OK: $OUTPUT_ZIP ($(du -h "$OUTPUT_ZIP" | awk '{print $1}'))"

#!/usr/bin/env bash
set -euo pipefail

# Package Chrome extension for distribution
# Input: tools/chrome-extension/save-to-shinen/
# Output: dist/save-to-shinen.zip

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/tools/chrome-extension/save-to-shinen"
DIST_DIR="$REPO_ROOT/dist"
OUTPUT_ZIP="$DIST_DIR/save-to-shinen.zip"

echo "📦 Packaging Save to SHINEN Chrome Extension..."

# Validate source directory
if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Error: Source directory not found: $SOURCE_DIR"
  exit 1
fi

if [ ! -f "$SOURCE_DIR/manifest.json" ]; then
  echo "❌ Error: manifest.json not found in $SOURCE_DIR"
  exit 1
fi

# Create dist directory
mkdir -p "$DIST_DIR"

# Remove old zip if exists
rm -f "$OUTPUT_ZIP"

# Create zip (cd into source so manifest.json is at root)
echo "  Creating ZIP..."
cd "$SOURCE_DIR"
zip -r "$OUTPUT_ZIP" . -x "*.DS_Store" -x "__MACOSX*" -x "*.sh" -x "TEST.md" -x "README.md"

# Verify zip contents
echo "  Verifying ZIP contents..."
if ! unzip -l "$OUTPUT_ZIP" | grep -q "manifest.json"; then
  echo "❌ Error: manifest.json not found in ZIP root"
  exit 1
fi

echo "✅ Extension packaged successfully!"
echo "   Output: $OUTPUT_ZIP"
echo "   Size: $(du -h "$OUTPUT_ZIP" | cut -f1)"

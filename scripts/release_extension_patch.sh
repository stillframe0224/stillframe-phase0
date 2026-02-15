#!/usr/bin/env bash
set -euo pipefail

# One-button extension patch release
# Usage: bash scripts/release_extension_patch.sh
#
# Prerequisites:
# - Clean repo (no uncommitted changes)
# - On main branch
# - gh authenticated
#
# Actions:
# 1. Bump manifest.json PATCH version (X.Y.Z -> X.Y.Z+1)
# 2. Verify ZIP structure (manifest at root)
# 3. Commit and push to main
# 4. Wait for GitHub Release to be created with assets
# 5. Audit the published release ZIP
# 6. Report success

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST_PATH="$REPO_ROOT/tools/chrome-extension/save-to-shinen/manifest.json"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

echo "=== Extension Patch Release ==="
echo ""

# Precondition checks
cd "$REPO_ROOT"

if ! git diff --quiet; then
  fail "Repository has uncommitted changes. Commit or stash them first."
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  fail "Must be on main branch (currently on: $CURRENT_BRANCH)"
fi

if ! gh auth status >/dev/null 2>&1; then
  fail "gh not authenticated. Run: gh auth login"
fi

echo "✅ Preconditions passed"
echo ""

# Read current version
CURRENT_VERSION="$(node -p "require('$MANIFEST_PATH').version" 2>/dev/null || true)"
if [[ -z "$CURRENT_VERSION" || "$CURRENT_VERSION" == "null" ]]; then
  fail "Could not read version from manifest.json"
fi

echo "Current version: $CURRENT_VERSION"

# Bump PATCH
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
TAG="v${NEW_VERSION}"

echo "New version:     $NEW_VERSION"
echo "Tag:             $TAG"
echo ""

# Update manifest.json
node -e "
const fs = require('fs');
const path = '$MANIFEST_PATH';
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
manifest.version = '$NEW_VERSION';
fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
" || fail "Failed to update manifest.json"

echo "✅ Bumped manifest.json to $NEW_VERSION"

# Verify ZIP structure
echo ""
echo "Verifying extension ZIP structure..."
bash "$SCRIPT_DIR/verify_extension_zip.sh" || fail "ZIP verification failed"

echo ""
echo "✅ ZIP verification passed"

# Commit and push
echo ""
echo "Committing and pushing..."
git add "$MANIFEST_PATH"
git commit -m "chore(extension): bump to v${NEW_VERSION}" >/dev/null
git push origin main

echo "✅ Pushed to main"

# Wait for Release
echo ""
echo "Waiting for GitHub Release $TAG to be created..."

MAX_TRIES=24
SLEEP_SEC=10

for i in $(seq 1 $MAX_TRIES); do
  echo "  Attempt $i/$MAX_TRIES..."

  if gh release view "$TAG" --json assets >/dev/null 2>&1; then
    ASSETS="$(gh release view "$TAG" --json assets -q '.assets[].name' 2>/dev/null || true)"

    if echo "$ASSETS" | grep -q "save-to-shinen.zip" && echo "$ASSETS" | grep -q "save-to-shinen.zip.sha256"; then
      echo ""
      echo "✅ Release $TAG created with assets"
      break
    fi
  fi

  if [[ $i -eq $MAX_TRIES ]]; then
    fail "Release $TAG not created within timeout ($((MAX_TRIES * SLEEP_SEC))s)"
  fi

  sleep $SLEEP_SEC
done

# Audit the release
echo ""
echo "Auditing published release assets..."
bash "$SCRIPT_DIR/audit_release_asset.sh" "$TAG" || fail "Release audit failed"

# Final summary
RELEASE_URL="$(gh release view "$TAG" --json url -q .url)"

echo ""
echo "=== Release Complete ==="
echo "Tag:         $TAG"
echo "Release URL: $RELEASE_URL"
echo "Status:      ✅ PASS"
echo ""

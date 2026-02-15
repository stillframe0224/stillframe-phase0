#!/usr/bin/env bash
set -euo pipefail

# One-button extension patch release with safe defaults
# Usage:
#   bash scripts/release_extension_patch.sh           # dry-run (default)
#   bash scripts/release_extension_patch.sh --dry-run # dry-run (explicit)
#   bash scripts/release_extension_patch.sh --apply   # actual release
#
# Prerequisites:
# - Clean repo (no uncommitted changes)
# - On main branch
# - gh authenticated
#
# Actions (--dry-run):
# 1. Verify preconditions
# 2. Compute next PATCH version
# 3. Verify ZIP structure would pass
# 4. Exit without changes
#
# Actions (--apply):
# 1. Verify preconditions
# 2. Bump manifest.json PATCH version (X.Y.Z -> X.Y.Z+1)
# 3. Ensure INSTALL.md mentions Release asset download
# 4. Verify ZIP structure (manifest at root)
# 5. Commit and push to main
# 6. Wait for GitHub Release to be created with assets
# 7. Audit the published release ZIP
# 8. Report success

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST_PATH="$REPO_ROOT/tools/chrome-extension/save-to-shinen/manifest.json"
INSTALL_MD_PATH="$REPO_ROOT/tools/chrome-extension/save-to-shinen/INSTALL.md"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

# Parse mode
MODE="dry-run"
if [[ "${1:-}" == "--apply" ]]; then
  MODE="apply"
elif [[ "${1:-}" == "--dry-run" ]]; then
  MODE="dry-run"
elif [[ -n "${1:-}" ]]; then
  fail "Unknown argument: $1 (expected --dry-run or --apply)"
fi

echo "=== Extension Patch Release ($MODE mode) ==="
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

if [[ "$MODE" == "dry-run" ]]; then
  echo "=== Dry-run mode: verifying ZIP structure ===="
  echo ""
  bash "$SCRIPT_DIR/verify_extension_zip.sh" || fail "ZIP verification failed"

  echo ""
  echo "=== Dry-run Complete ==="
  echo "✅ All checks passed"
  echo ""
  echo "To apply this release, run:"
  echo "  bash scripts/release_extension_patch.sh --apply"
  echo ""
  exit 0
fi

# --apply mode continues here

# Update manifest.json
node -e "
const fs = require('fs');
const path = '$MANIFEST_PATH';
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
manifest.version = '$NEW_VERSION';
fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
" || fail "Failed to update manifest.json"

echo "✅ Bumped manifest.json to $NEW_VERSION"

# Ensure INSTALL.md includes Release asset warning
RELEASE_ASSET_WARNING="Download the Release asset save-to-shinen.zip (NOT Source code (zip))"

if ! grep -Fq "$RELEASE_ASSET_WARNING" "$INSTALL_MD_PATH"; then
  echo ""
  echo "Adding Release asset warning to INSTALL.md..."

  # Insert after line 16 (the release ZIP mention)
  sed -i.bak '16 a\
   - **IMPORTANT**: Download the Release asset `save-to-shinen.zip` (NOT "Source code (zip)")
' "$INSTALL_MD_PATH" || fail "Failed to update INSTALL.md"

  rm -f "${INSTALL_MD_PATH}.bak"
  echo "✅ Updated INSTALL.md with Release asset warning"
fi

# Verify ZIP structure
echo ""
echo "Verifying extension ZIP structure..."
bash "$SCRIPT_DIR/verify_extension_zip.sh" || fail "ZIP verification failed"

echo ""
echo "✅ ZIP verification passed"

# Commit and push
echo ""
echo "Committing and pushing..."

FILES_TO_COMMIT=("$MANIFEST_PATH")
if ! git diff --quiet "$INSTALL_MD_PATH"; then
  FILES_TO_COMMIT+=("$INSTALL_MD_PATH")
fi

git add "${FILES_TO_COMMIT[@]}"
git commit -m "$(cat <<'EOF'
chore(extension): bump to v${NEW_VERSION}

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)" >/dev/null

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

#!/usr/bin/env bash
# enso_verify.sh - Verify local enso.png integrity (no curl, no network required)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
LOCAL_PNG="${LOCAL_PNG:-$ROOT/public/enso.png}"
SHA_FILE="$ROOT/public/enso.png.sha256"
PNG_SIG="89504e470d0a1a0a"

echo "=== enso.png local verification ==="
echo "File: $LOCAL_PNG"

# 1. Exists
if [[ ! -f "$LOCAL_PNG" ]]; then
  echo "❌ FAIL: file not found: $LOCAL_PNG"
  exit 1
fi

# 2. PNG signature (magic bytes)
actual_sig="$(xxd -p -l 8 "$LOCAL_PNG" | tr -d '\n')"
if [[ "$actual_sig" == "$PNG_SIG" ]]; then
  echo "✅ PNG signature: $actual_sig"
else
  echo "❌ PNG signature MISMATCH: got=$actual_sig expected=$PNG_SIG"
  exit 1
fi

# 3. sha256 vs SSOT baseline
actual_sha="$(shasum -a 256 "$LOCAL_PNG" | awk '{print $1}')"
if [[ -f "$SHA_FILE" ]]; then
  expected_sha="$(awk '{print $1}' "$SHA_FILE")"
  if [[ "$actual_sha" == "$expected_sha" ]]; then
    echo "✅ sha256: $actual_sha (matches baseline)"
  else
    echo "❌ sha256 MISMATCH:"
    echo "   actual:   $actual_sha"
    echo "   expected: $expected_sha"
    exit 1
  fi
else
  echo "ℹ️  sha256: $actual_sha (no baseline, generating...)"
  echo "$actual_sha  public/enso.png" > "$SHA_FILE"
  echo "✅ Baseline written: $SHA_FILE"
fi

# 4. File size (sanity: must be >10KB)
size_bytes="$(wc -c < "$LOCAL_PNG" | tr -d ' ')"
if [[ "$size_bytes" -lt 10240 ]]; then
  echo "❌ File too small: ${size_bytes} bytes (expected >10KB)"
  exit 1
fi
echo "✅ Size: ${size_bytes} bytes"

# 5. Dimensions via sips (macOS only, soft check)
if command -v sips &>/dev/null; then
  dims="$(sips -g pixelWidth -g pixelHeight "$LOCAL_PNG" 2>/dev/null | grep -E 'pixel(Width|Height)' | awk '{print $2}' | tr '\n' 'x' | sed 's/x$//')"
  echo "✅ Dimensions: ${dims}px"
fi

echo ""
echo "✅ ALL CHECKS PASSED"
echo "SSOT baseline: $SHA_FILE"

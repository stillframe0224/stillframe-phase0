#!/usr/bin/env bash
# scripts/tests/test_design_tokens.sh
# ── SHINEN design token regression guard ──────────────────────────────────────
# Fails if banned legacy colors appear in app/app/ style props (non-SVG),
# or if AppCard reverts boxShadow to bare "none".
#
# Banned colors: beige/yellow tones removed in SSOT refactor (2026-02-21)
#   #FFF8F0  #F5C882  #D9A441  #FEFCE8
#
# SVG fallback illustrations in AppCard (lines inside <svg>…</svg>) are
# intentionally exempt — those are design glyphs, not layout/card styles.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PASS=0
FAIL=0

_ok()   { echo "  ✓ $*"; PASS=$((PASS+1)); }
_fail() { echo "  ✗ $*"; FAIL=$((FAIL+1)); }
_head() { echo; echo "── $* ──"; }

# ── 1. Banned colors in style= props (app/app/ only) ─────────────────────────
# Strategy: grep for the banned hex, then exclude lines that are inside
# SVG attribute context (fill=, stroke= on SVG shape elements).
# We detect SVG context by checking if the matching line contains a raw SVG
# attribute form: fill="#..." or stroke="#..." without "style".
_head "Banned colors in app/app/ style props"

BANNED_PATTERN='#FFF8F0|#F5C882|#D9A441|#FEFCE8'

# Collect matches, strip SVG-attribute-only lines (fill="..." stroke="..." without style{)
# A line is SVG-attribute-only if it matches:  fill="#COLOR" or stroke="#COLOR"
# and does NOT contain "style=" or "background" or "color:" or "border"
SVG_ATTR_PATTERN='(fill|stroke)="#[^"]*"'
STYLE_KEYWORDS='style=|background|color:|border|borderColor'

# Run rg, filter out pure SVG-attribute lines
VIOLATIONS=$(
  rg --no-heading -n "$BANNED_PATTERN" app/app/ 2>/dev/null \
  | grep -vE "$SVG_ATTR_PATTERN" \
  | grep -E "$STYLE_KEYWORDS" \
  || true
)

if [[ -z "$VIOLATIONS" ]]; then
  _ok "No banned legacy colors in style props"
else
  echo "$VIOLATIONS"
  _fail "Banned legacy colors found in style props — replace with CSS var(--text)/var(--muted)/var(--card-border) etc."
fi

# ── 2. AppCard boxShadow must not revert to bare "none" ──────────────────────
_head "AppCard boxShadow revert check"

# Check: onMouseLeave sets boxShadow to var(--card-shadow, ...) not "none"
SHADOW_NONE=$(rg 'boxShadow.*[^a-z]none[^a-z]' app/app/AppCard.tsx 2>/dev/null || true)

if [[ -z "$SHADOW_NONE" ]]; then
  _ok "No boxShadow 'none' revert in AppCard"
else
  echo "$SHADOW_NONE"
  _fail "AppCard boxShadow reverts to 'none' — use var(--card-shadow) instead"
fi

# ── 3. Card background must reference var(--card-bg) not hardcoded beige ─────
_head "AppCard background token check"

# Check that the main card container uses var(--card-bg) not ct.bg
CARD_BG_CT=$(rg 'background.*ct\.bg' app/app/AppCard.tsx 2>/dev/null || true)

if [[ -z "$CARD_BG_CT" ]]; then
  _ok "AppCard does not use ct.bg for card background"
else
  echo "$CARD_BG_CT"
  _fail "AppCard uses ct.bg (type-specific color) for card background — use var(--card-bg) instead"
fi

# ── 4. CSS SSOT tokens are defined ───────────────────────────────────────────
_head "CSS SSOT token presence"

REQUIRED_TOKENS=(
  "--card-bg"
  "--card-border"
  "--card-radius"
  "--card-shadow"
  "--grid-size"
  "--grid-line"
  "--text"
  "--muted"
)
for TOKEN in "${REQUIRED_TOKENS[@]}"; do
  if grep -qF -- "$TOKEN" app/globals.css 2>/dev/null; then
    _ok "$TOKEN defined in globals.css"
  else
    _fail "$TOKEN missing from globals.css"
  fi
done

# ── 5. app-grid-bg class applied to /app page ─────────────────────────────────
_head "Grid background class in page.tsx"

if grep -qF 'app-grid-bg' app/app/page.tsx 2>/dev/null; then
  _ok "app-grid-bg class applied in page.tsx"
else
  _fail "app-grid-bg class missing from page.tsx — grid background not applied"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo "Results: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  echo "DESIGN TOKEN GUARD FAILED"
  exit 1
fi
echo "ALL DESIGN TOKEN CHECKS PASSED"

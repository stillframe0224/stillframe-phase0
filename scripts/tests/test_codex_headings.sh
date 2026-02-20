#!/usr/bin/env bash
set -euo pipefail

TEST_TMP_DIR=""

scan_has_headings() { # file -> "r t e", fence-aware, strict ##
  local f="$1"
  awk '
    BEGIN { in_fence=0; r=0; t=0; e=0 }
    {
      line=$0
      sub(/\r$/, "", line)
      gsub(/[ \t]+$/, "", line)
      if (line ~ /^[ \t]*(```|~~~)/) { in_fence=!in_fence; next }
      if (!in_fence) {
        if (line ~ /^## Codex: RISKS[ \t]*$/) r=1
        if (line ~ /^## Codex: TESTS[ \t]*$/) t=1
        if (line ~ /^## Codex: EDGE[ \t]*$/)  e=1
      }
    }
    END { printf "%d %d %d\n", r,t,e }
  ' "$f"
}

prepend_missing_locally() { # file -> rewrites file
  local f="$1"
  local r t e
  read -r r t e < <(scan_has_headings "$f")
  local pre=""
  [[ "$r" -eq 0 ]] && pre+=$'## Codex: RISKS\n- (fill)\n\n'
  [[ "$t" -eq 0 ]] && pre+=$'## Codex: TESTS\n- (fill)\n\n'
  [[ "$e" -eq 0 ]] && pre+=$'## Codex: EDGE\n- (fill)\n\n'
  [[ -z "$pre" ]] && return 0
  local tmp="${f}.new"
  { printf '%s' "$pre"; cat "$f"; } > "$tmp"
  mv "$tmp" "$f"
}

assert_eq() {
  [[ "$1" == "$2" ]] || { echo "assert failed: '$1' != '$2'"; exit 1; }
}

run_tests() {
  TEST_TMP_DIR="$(mktemp -d)"
  trap '[[ -n "${TEST_TMP_DIR:-}" ]] && rm -rf "$TEST_TMP_DIR"' EXIT

  : > "$TEST_TMP_DIR/empty.md"
  prepend_missing_locally "$TEST_TMP_DIR/empty.md"
  assert_eq "$(scan_has_headings "$TEST_TMP_DIR/empty.md")" "1 1 1"

  cat > "$TEST_TMP_DIR/partial.md" <<'MD'
## Codex: RISKS
- ok
MD
  prepend_missing_locally "$TEST_TMP_DIR/partial.md"
  assert_eq "$(scan_has_headings "$TEST_TMP_DIR/partial.md")" "1 1 1"

  cp "$TEST_TMP_DIR/partial.md" "$TEST_TMP_DIR/idem.md"
  local sha1_before sha1_after
  sha1_before="$(shasum "$TEST_TMP_DIR/idem.md" | awk '{print $1}')"
  prepend_missing_locally "$TEST_TMP_DIR/idem.md"
  sha1_after="$(shasum "$TEST_TMP_DIR/idem.md" | awk '{print $1}')"
  assert_eq "$sha1_before" "$sha1_after"

  cat > "$TEST_TMP_DIR/fence.md" <<'MD'
```md
## Codex: RISKS
## Codex: TESTS
## Codex: EDGE
```
MD
  assert_eq "$(scan_has_headings "$TEST_TMP_DIR/fence.md")" "0 0 0"
  prepend_missing_locally "$TEST_TMP_DIR/fence.md"
  assert_eq "$(scan_has_headings "$TEST_TMP_DIR/fence.md")" "1 1 1"

  cat > "$TEST_TMP_DIR/present.md" <<'MD'
## Codex: RISKS
- a

## Codex: TESTS
- b

## Codex: EDGE
- c
MD
  local s1 s2
  s1="$(shasum "$TEST_TMP_DIR/present.md" | awk '{print $1}')"
  prepend_missing_locally "$TEST_TMP_DIR/present.md"
  s2="$(shasum "$TEST_TMP_DIR/present.md" | awk '{print $1}')"
  assert_eq "$s1" "$s2"

  # Indented fence (e.g. list-item code block) must also be detected
  cat > "$TEST_TMP_DIR/indent_fence.md" <<'MD'
  ```yaml
  ## Codex: RISKS
  ## Codex: TESTS
  ## Codex: EDGE
  ```
MD
  assert_eq "$(scan_has_headings "$TEST_TMP_DIR/indent_fence.md")" "0 0 0"
  prepend_missing_locally "$TEST_TMP_DIR/indent_fence.md"
  assert_eq "$(scan_has_headings "$TEST_TMP_DIR/indent_fence.md")" "1 1 1"

  echo "ALL TESTS PASSED"
}

run_tests

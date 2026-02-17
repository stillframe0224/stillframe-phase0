#!/bin/bash
set -euo pipefail
# ──────────────────────────────────────────────────
# shinen-runner launchd management
# Usage: bash scripts/shinen_runner_launchd.sh <install|start|stop|status|log>
# ──────────────────────────────────────────────────

ROOT="/Users/array0224/stillframe-phase0"
LABEL="com.stillframe.shinen-runner"
PLIST_SRC="$ROOT/launchd/$LABEL.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/stillframe"
GUI_DOMAIN="gui/$(id -u)"

cmd="${1:-help}"

case "$cmd" in
  install)
    mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
    cp "$PLIST_SRC" "$PLIST_DST"
    echo "✓ Installed plist → $PLIST_DST"
    echo "  Run: bash scripts/shinen_runner_launchd.sh start"
    ;;

  start)
    launchctl bootout "$GUI_DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$GUI_DOMAIN" "$PLIST_DST"
    echo "✓ Started $LABEL"
    ;;

  stop)
    launchctl bootout "$GUI_DOMAIN/$LABEL" 2>/dev/null || true
    echo "✓ Stopped $LABEL"
    ;;

  status)
    launchctl print "$GUI_DOMAIN/$LABEL" 2>&1 | head -20 || echo "(not loaded)"
    ;;

  log)
    echo "=== STDERR (last 200 lines) ==="
    tail -n 200 "$LOG_DIR/shinen-runner.err.log" 2>/dev/null || echo "(no log yet)"
    echo ""
    echo "=== STDOUT (last 50 lines) ==="
    tail -n 50 "$LOG_DIR/shinen-runner.out.log" 2>/dev/null || echo "(no log yet)"
    ;;

  *)
    echo "Usage: $0 <install|start|stop|status|log>"
    exit 1
    ;;
esac

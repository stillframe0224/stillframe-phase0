#!/usr/bin/env python3
"""
Notification hook stub for Claude Code events.
Minimal pass-through implementation.
"""
import sys

# Read stdin (hook receives JSON event data)
_ = sys.stdin.read()

# Pass through (exit 0 = allow, no notification sent)
sys.exit(0)

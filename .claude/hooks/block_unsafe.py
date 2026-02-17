#!/usr/bin/env python3
"""
PreToolUse hook: Block clearly unsafe bash patterns.
Minimal implementation - settings.local.json permissions.deny list is the real filter.
This hook exists to prevent "file not found" errors that block all commands.
"""
import sys
import os
import json

def main():
    # Read hook input from stdin (JSON with tool name, parameters)
    try:
        hook_input = json.loads(sys.stdin.read())
    except Exception:
        # If we can't parse input, allow (fail open)
        sys.exit(0)

    tool = hook_input.get("tool", "")
    params = hook_input.get("parameters", {})

    # For Bash tool, check command
    if tool == "Bash":
        command = params.get("command", "")

        # Block obviously dangerous patterns (defense in depth)
        dangerous = [
            "rm -rf /",
            "mkfs",
            "dd if=/dev/",
            "> /dev/sd",
        ]

        for pattern in dangerous:
            if pattern in command:
                print(f"BLOCKED: Dangerous pattern detected: {pattern}", file=sys.stderr)
                sys.exit(1)

    # Allow all other cases
    sys.exit(0)

if __name__ == "__main__":
    main()

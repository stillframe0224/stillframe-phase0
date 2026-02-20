# Claude Code Memory — Operator Note

## Overview

Claude Code has a built-in persistent memory system. Memory files persist across conversations and are automatically loaded into context.

## Data location

```
~/.claude/projects/<project-hash>/memory/MEMORY.md
```

- `MEMORY.md` is always loaded into the system prompt (first 200 lines).
- Additional topic files (e.g., `debugging.md`, `patterns.md`) can be created and linked from MEMORY.md.
- Data is local-only; never committed to the repo.

## Privacy rules

1. **Never paste credentials** in chat unless wrapped in `<private>...</private>` tags.
2. **Never commit** anything from `~/.claude/` to the repo.
3. Prefer referencing repo docs (`OPS/`, `CLAUDE.md`) rather than re-explaining in chat.
4. If Claude Code generates extra `CLAUDE.md` files in subfolders, treat them as generated context; do not commit by default.

## What to save in memory

- Stable patterns confirmed across multiple interactions
- Key architectural decisions and important file paths
- User preferences for workflow, tools, and communication
- Solutions to recurring problems

## What NOT to save

- Session-specific context (current task details, temporary state)
- Unverified conclusions from reading a single file
- Anything that duplicates `CLAUDE.md` or `OPS/` docs
- Secrets, tokens, or credentials (even inside `<private>` tags — those are for chat only)

## Quick checks

```bash
# Memory directory exists?
ls ~/.claude/projects/*/memory/MEMORY.md 2>/dev/null && echo "found" || echo "no memory files yet"

# Current project memory
cat ~/.claude/projects/-Users-array0224/memory/MEMORY.md 2>/dev/null | head -20
```

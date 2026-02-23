---
description: Security rules for SHINEN codebase
globs: ["app/**", "lib/**", "chrome-extension/**"]
---

# Security Rules

## Supabase
- NEVER expose `service_role` key in client code or NEXT_PUBLIC_* env vars
- ALL database queries from client MUST go through RLS-protected tables
- Server-side API routes that use service_role MUST validate auth first

## Auth
- OAuth callback MUST verify `state` parameter to prevent CSRF
- NEVER redirect to user-supplied URLs without allowlist validation
- Session tokens belong in httpOnly cookies, NOT localStorage

## XSS
- NEVER use `dangerouslySetInnerHTML` without DOMPurify sanitization
- User-provided URLs MUST be validated (protocol allowlist: https, http)
- Chrome extension `content_scripts` MUST NOT inject user input into page DOM

## API Routes
- ALL state-changing endpoints MUST verify auth (getUser, not just getSession)
- Input validation on all API parameters (zod or manual)
- Rate limiting on public endpoints (/api/track, /api/waitlist)

## Secrets
- .env.local is gitignored — verify before every commit
- Chrome extension MUST NOT contain API keys in source
- Build-time secrets (non-NEXT_PUBLIC_) MUST NOT appear in client bundle

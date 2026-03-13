# SHINEN — Phase0

**Thought-capture app where every card gets an image**

Phase0 goal: LP → waitlist → early access → payment validation

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

Create `.env.local` in the project root:

```bash
# Supabase (required for app functionality)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Waitlist
NEXT_PUBLIC_WAITLIST_POST_URL=https://your-webhook-url
NEXT_PUBLIC_WAITLIST_FALLBACK_EMAIL=waitlist@yourdomain.com

# Gumroad checkout
NEXT_PUBLIC_GUMROAD_PRODUCT_URL=https://your-gumroad-product-url

# A/B Testing (optional)
NEXT_PUBLIC_HERO_CTA_VARIANT=A  # Options: A, B, C, D (or omit for default)
```

### A/B Testing the Hero CTA

The hero section's call-to-action button text can be changed via `NEXT_PUBLIC_HERO_CTA_VARIANT`:

| Variant | English | Japanese |
|---------|---------|----------|
| _(default)_ | Try Quick Capture | Quick Capture を試す |
| `A` | Start Capturing Thoughts | 思考のキャプチャを始める |
| `B` | Try It Now — Free Demo | 今すぐ試す — 無料デモ |
| `C` | See How It Works | 動作を見る |
| `D` | Experience Quick Capture | Quick Capture を体験 |

**Usage**:
1. Set `NEXT_PUBLIC_HERO_CTA_VARIANT=B` in your `.env.local` or Vercel environment variables
2. Rebuild: `npm run build`
3. The CTA button text will update accordingly

**For A/B testing**:
- Create multiple Vercel preview deployments, each with a different variant
- Use analytics tools to track conversion rates per variant
- Keep the best-performing variant

---

## Build & Deploy

```bash
# Production build
npm run build

# Test E2E locally
npm run test:e2e:dev  # requires E2E=1 in .env.local

# Test E2E guards (security invariants)
npm run test:e2e:guard

# Full E2E CI suite
npm run test:e2e:ci
```

**Deployment**: Merge to `main` → auto-deploys to Vercel

---

## Project Structure

```
app/
  page.tsx              # Landing page
  app/page.tsx          # Main app (requires auth)
  components/           # Reusable UI components
lib/
  copy.ts               # All user-facing text (i18n-ready)
  cardTypes.ts          # 8 thought types + styling
  track.ts              # Analytics helper
ops/
  GOALS.md              # Phase0 OKRs & task priorities
  GUARDS.md             # DO NOTs & completion criteria
.rwl/                   # Autonomous task tracking
  Queue/                # Pending tasks
  Current/              # In-progress tasks
  Done/                 # Completed tasks
  DONE.json             # Completion log
  logs/events.jsonl     # Event log
  status.json           # Failure count & last run
reports/
  triad/                # Task evidence files
  market_pulse/         # Market research reports
issues/
  auto_generated/       # Auto-generated issue drafts
```

---

## Key Features

- **Auto image capture**: Paste a URL → OGP image fetched automatically
- **8 thought types**: memo, idea, quote, task, feeling, image, fragment, dream
- **Fallback illustrations**: SVG patterns fill empty cards
- **i18n**: English + Japanese
- **Waitlist + Gumroad**: Early access flow

---

## Contributing

See `ops/GOALS.md` for current priorities and `ops/GUARDS.md` for development guidelines.

Autonomous tasks run nightly via `cron:shinen-nightly-autotasks`. Evidence is stored in `reports/triad/`.

---

**StillFrame** — _Where meaning settles._

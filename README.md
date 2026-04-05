# SHINEN (StillFrame Phase0)

> Every thought gets a picture.

**SHINEN** is a thought-capture application where every card automatically includes an image. Paste a URL and the OGP image auto-loads. Drop a photo and it becomes a card instantly. No manual image hunting. No tedious work. Just capture and collect your thoughts.

---

## 🎯 Project Overview

- **Phase**: Phase0 (LP + initial user acquisition + monetization proof)
- **Goal**: Prove that users with real pain points will use and pay for this product
- **Tech Stack**: Next.js 16, React 19, Supabase, Vercel
- **Repository**: https://github.com/array0224-cloud/stillframe-phase0

### Phase0 OKRs

- **KR1**: Waitlist registrations ≥ 50
- **KR2**: Gumroad purchases ≥ 3 ($29 tier)
- **KR3**: DAU ≥ 10 (7-day streak)
- **KR4**: Total cards created ≥ 100

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **Backend**: Supabase (Auth + Database)
- **Deployment**: Vercel
- **E2E Testing**: Playwright
- **Language**: TypeScript

---

## 📦 Prerequisites

- Node.js 18+ (recommended: use `nvm` or `fnm`)
- npm or yarn
- Git

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/array0224-cloud/stillframe-phase0.git
cd stillframe-phase0
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Gumroad (optional)
NEXT_PUBLIC_GUMROAD_PRODUCT_URL=your_gumroad_product_url

# Waitlist (optional)
NEXT_PUBLIC_WAITLIST_POST_URL=your_waitlist_webhook_url
NEXT_PUBLIC_WAITLIST_FALLBACK_EMAIL=your_fallback_email

# Analytics (optional)
NEXT_PUBLIC_ANALYTICS_ENABLED=false
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗 Build & Deploy

### Build for production

```bash
npm run build
```

### Start production server locally

```bash
npm start
```

### Deploy to Vercel

This project is configured for automatic deployment via Vercel:

1. Push to `main` branch
2. Vercel automatically builds and deploys
3. Preview deployments are created for PRs

---

## 🧪 Testing

### E2E tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run in CI mode
npm run test:e2e:ci

# Run guard tests (security invariants)
npm run test:e2e:guard

# Run smoke tests only
npm run test:smoke
```

### Unit tests

```bash
npm run test:unit
```

---

## 📊 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:e2e:guard` | Run guard tests (security) |
| `npm run test:smoke` | Run smoke tests |
| `npm run test:unit` | Run unit tests |
| `npm run market:pulse` | Generate market pulse report |
| `npm run subframe:sync` | Sync Subframe components |

---

## 📁 Project Structure

```
stillframe-phase0/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Landing page (LP)
│   ├── app/               # Main application
│   └── components/        # React components
├── lib/                   # Shared utilities
│   ├── copy.ts           # Copy/i18n strings
│   ├── cardTypes.ts      # Card type definitions
│   └── track.ts          # Analytics tracking
├── ui/                    # UI components
├── e2e/                   # Playwright E2E tests
├── scripts/               # Build & automation scripts
├── tools/                 # CLI tools (market pulse, etc.)
├── reports/               # Generated reports
│   ├── triad/            # Task evidence reports
│   └── market_pulse/     # Market research reports
├── .rwl/                  # Autonomous agent runtime
│   ├── Queue/            # Pending tasks
│   ├── Current/          # Active tasks
│   ├── Done/             # Completed tasks
│   └── logs/             # Event logs
└── ops/                   # Operational docs
    ├── GOALS.md          # Project goals & OKRs
    └── GUARDS.md         # Task constraints & DoD
```

---

## 🔒 Security & E2E Bypass Guards

This project enforces strict security invariants for E2E test bypasses:

- **4-layer sealed architecture** prevents production abuse
- E2E mode is **localhost-only** and sealed via `Object.defineProperty`
- CI guard tests ensure invariants never break
- See `ops/GUARDS.md` for full details

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes and commit: `git commit -m "feat: your feature"`
3. Push and create a PR: `git push origin feat/your-feature`
4. **Never push directly to `main`** (enforced by project rules)
5. Ensure `npm run build` passes before creating PR

### Commit Convention

```
type: short description

Co-Authored-By: Your Name <your@email.com>
```

**Types**: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`

---

## 📝 License

Proprietary - StillFrame Project

---

## 🙋‍♂️ Support

For questions or issues, please create an issue in the GitHub repository.

# SHINEN Lite Phase0 — Deploy Guide

## Prerequisites

- GitHub repository with this codebase pushed
- Vercel account (free tier is sufficient)

## 1. Deploy to Vercel

### Option A: GitHub Integration (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select the `stillframe-phase0` repository
4. Framework Preset will auto-detect **Next.js**
5. Click **Deploy**

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts. Defaults are correct for Next.js.

## 2. Environment Variables

Set these in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_GUMROAD_PRODUCT_URL` | Yes | Gumroad product link (e.g. `https://your-link.gumroad.com/l/shinen`) |
| `NEXT_PUBLIC_WAITLIST_FALLBACK_EMAIL` | Yes | Fallback email for waitlist when POST URL is not set |
| `NEXT_PUBLIC_WAITLIST_POST_URL` | No | POST endpoint for waitlist submissions |

After adding variables, trigger a **Redeploy** from the Deployments tab.

## 3. Verification

### 3.1 Page Load
- Visit the deployed URL (`/`)
- Confirm the LP renders: Nav, Hero, sample cards, Demo, Pricing, Waitlist, Footer
- Toggle language between English and 日本語

### 3.2 Demo Interaction
- Scroll to `#demo` section
- Select a card type, enter text, press Enter
- Confirm a ThoughtCard appears with animation

### 3.3 Tracking
- Open **Browser DevTools → Network** tab
- Add a card in the Demo section
- Confirm a POST to `/api/track` fires with `card_add` event
- In **Vercel Dashboard → Project → Logs (Functions)**, confirm the event JSON appears

### 3.4 Waitlist
- Enter an email in the waitlist form
- If `NEXT_PUBLIC_WAITLIST_POST_URL` is set: confirm POST is sent
- If not set: confirm `mailto:` fallback opens

### 3.5 Pricing
- Click "Get Early Access" → confirm it opens the Gumroad URL in a new tab

## 4. Troubleshooting

### Build Errors

```bash
# Check build locally first
npm run build
```

Common issues:
- **TypeScript errors**: Run `npx tsc --noEmit` to check
- **Missing dependencies**: Run `npm install`
- **Environment variables**: Ensure all `NEXT_PUBLIC_*` vars are set in Vercel

### Runtime Errors
- Check **Vercel Dashboard → Project → Logs** for server-side errors
- Check browser console for client-side errors

### Fonts Not Loading
- Google Fonts are loaded via `next/font`. Ensure no ad blocker is interfering.
- Fonts are set with `display: "swap"` so text will show immediately with fallback.

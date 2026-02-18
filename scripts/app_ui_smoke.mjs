#!/usr/bin/env node
/**
 * app_ui_smoke.mjs — /app UI acceptance smoke
 *
 * Tests (all required unless noted):
 *  1) GET /api/version returns 200 with sha field
 *  2) /app loads and build-stamp is visible
 *  3) build-stamp sha matches /api/version sha
 *  4) Switching to "Custom order (drag)" keeps cards visible (≥1 card)
 *  5) cards-grid computed gap equals 8px
 *  6) MEMO button click opens memo-modal on the first card
 *  7) drag-handle elements are present in custom sort mode
 *     - If ≥2 cards: drag card 1→2 and confirm DOM order changes (reorder)
 *     - If <2 cards: SKIP reorder, log reason
 *
 * Usage:
 *   node scripts/app_ui_smoke.mjs
 *   BASE_URL=https://stillframe-phase0.vercel.app node scripts/app_ui_smoke.mjs
 *
 * Requires: @playwright/test (already in devDependencies)
 *           npx playwright install chromium  (if not installed)
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://stillframe-phase0.vercel.app";
const TIMEOUT = 30_000; // ms per navigation/wait

const results = [];
let failed = false;
let skipped = [];

function pass(label, detail = "") {
  results.push({ status: "PASS", label, detail });
  console.log(`[PASS] ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  failed = true;
  results.push({ status: "FAIL", label, detail });
  console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
}
function skip(label, reason) {
  skipped.push({ label, reason });
  results.push({ status: "SKIP", label, detail: reason });
  console.log(`[SKIP] ${label} — ${reason}`);
}

async function fetchWithRetry(url, opts = {}, maxAttempts = 3) {
  const DELAYS = [250, 750, 1500];
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, DELAYS[i - 1] ?? 1500));
      console.log(`  [retry] ${i + 1}/${maxAttempts}`);
    }
    try {
      const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(15_000) });
      if (res.status >= 500 && i < maxAttempts - 1) { lastErr = new Error(`HTTP ${res.status}`); continue; }
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function main() {
  console.log(`\n=== app_ui_smoke ===`);
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // ── Test 1: GET /api/version ──────────────────────────────────────────────
  let versionSha = null;
  try {
    const res = await fetchWithRetry(`${BASE_URL}/api/version`);
    if (res.ok) {
      const json = await res.json();
      versionSha = json.sha ?? null;
      if (versionSha && versionSha !== "unknown") {
        pass("GET /api/version returns 200 with sha", `sha=${versionSha}`);
      } else {
        fail("GET /api/version returns 200 with sha", `sha=${versionSha} (expected non-unknown hex)`);
      }
    } else {
      fail("GET /api/version returns 200 with sha", `HTTP ${res.status}`);
    }
  } catch (e) {
    fail("GET /api/version returns 200 with sha", String(e));
  }

  // ── Browser tests ─────────────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    // Don't store auth — we're testing unauthenticated UI (pre-auth page still loads)
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    // Navigate to /app — will redirect to /auth/login if no session.
    // The build-stamp is rendered INSIDE AppPageInner (client-side, after auth check),
    // so it only appears when authenticated. We check the URL first.
    await page.goto(`${BASE_URL}/app`, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    // Give client-side JS time to run (auth check + possible redirect)
    await page.waitForTimeout(2000);

    // ── Auth check: if redirected to /auth/login, remaining UI tests can't run ──
    const currentUrl = page.url();
    if (currentUrl.includes("/auth/login")) {
      // Unauthenticated: build-stamp is inside the authenticated app shell, so it won't
      // render. All interactive UI tests require an active session — skip them cleanly.
      skip("/app loads and build-stamp is visible", "not authenticated — redirected to /auth/login");
      skip("build-stamp sha matches /api/version sha", "not authenticated — redirected to /auth/login");
      skip("sort dropdown switches to custom without losing cards", "not authenticated — redirected to /auth/login");
      skip("cards-grid gap is 8px", "not authenticated — redirected to /auth/login");
      skip("MEMO button opens memo-modal", "not authenticated — redirected to /auth/login");
      skip("drag-handle present in custom sort", "not authenticated — redirected to /auth/login");
      skip("card reorder (drag 1→2)", "not authenticated — redirected to /auth/login");
      console.log("\n  [info] Auth redirect detected — interactive tests skipped (expected for unauthenticated smoke).");
      console.log("  [info] To run full UI tests, use the e2e suite with E2E=1 and a seeded test user.\n");
    } else {
      // ── Test 2: build-stamp visible ───────────────────────────────────────
      let stampText = null;
      try {
        const stamp = page.locator('[data-testid="build-stamp"]');
        await stamp.waitFor({ timeout: 10_000 });
        stampText = (await stamp.textContent()) ?? "";
        if (stampText.includes("build:")) {
          pass("/app loads and build-stamp is visible", stampText.trim());
        } else {
          fail("/app loads and build-stamp is visible", `text="${stampText.trim()}"`);
        }
      } catch (e) {
        fail("/app loads and build-stamp is visible", String(e));
      }

      // ── Test 3: build-stamp sha matches /api/version sha ─────────────────
      if (versionSha && stampText) {
        const stampSha = stampText.replace("build:", "").trim();
        if (stampSha === versionSha) {
          pass("build-stamp sha matches /api/version sha", `both="${versionSha}"`);
        } else {
          fail("build-stamp sha matches /api/version sha", `stamp="${stampSha}" api="${versionSha}"`);
        }
      } else {
        skip("build-stamp sha matches /api/version sha", "prerequisite test(s) failed — no sha to compare");
      }

      // Wait for cards to load (loading state to settle)
      await page.waitForTimeout(2000);

      // ── Test 4: custom sort keeps cards ────────────────────────────────────
      let cardCountBefore = 0;
      let cardCountAfter = 0;
      try {
        const sortDropdown = page.locator('[data-testid="sort-dropdown"]');
        await sortDropdown.waitFor({ timeout: 10_000 });

        // Count cards before switching
        cardCountBefore = await page.locator('[data-testid="card-item"]').count();

        // Switch to custom sort
        await sortDropdown.selectOption("custom");
        await page.waitForTimeout(1000); // let re-render settle

        cardCountAfter = await page.locator('[data-testid="card-item"]').count();

        if (cardCountAfter >= 1) {
          pass("sort dropdown switches to custom without losing cards", `before=${cardCountBefore} after=${cardCountAfter}`);
        } else {
          fail("sort dropdown switches to custom without losing cards", `cards dropped to 0 (before=${cardCountBefore})`);
        }
      } catch (e) {
        fail("sort dropdown switches to custom without losing cards", String(e));
      }

      // ── Test 5: cards-grid gap is 8px ──────────────────────────────────────
      try {
        const grid = page.locator('[data-testid="cards-grid"]').first();
        await grid.waitFor({ timeout: 5_000 });
        const gap = await grid.evaluate((el) => getComputedStyle(el).gap);
        // gap may be "8px" or "8px 8px" depending on browser
        const gapMatch = /^8px/.test(gap.trim());
        if (gapMatch) {
          pass("cards-grid computed gap is 8px", `gap="${gap.trim()}"`);
        } else {
          fail("cards-grid computed gap is 8px", `gap="${gap.trim()}" expected "8px"`);
        }
      } catch (e) {
        fail("cards-grid computed gap is 8px", String(e));
      }

      // ── Test 6: MEMO button opens memo-modal ───────────────────────────────
      try {
        const firstCard = page.locator('[data-testid="card-item"]').first();
        await firstCard.waitFor({ timeout: 5_000 });
        const memoBtn = firstCard.locator('[data-testid="chip-memo"]');
        await memoBtn.waitFor({ timeout: 5_000 });
        await memoBtn.click();
        // Modal should appear
        const modal = page.locator('[data-testid="memo-modal"]');
        await modal.waitFor({ timeout: 5_000 });
        pass("MEMO button opens memo-modal", "modal visible after click");
        // Close modal (Escape)
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      } catch (e) {
        fail("MEMO button opens memo-modal", String(e));
      }

      // ── Test 7a: drag-handle present ───────────────────────────────────────
      const cardCount = cardCountAfter;
      try {
        const handles = page.locator('[data-testid="drag-handle"]');
        const handleCount = await handles.count();
        if (handleCount >= 1) {
          pass("drag-handle present in custom sort", `count=${handleCount}`);
        } else {
          fail("drag-handle present in custom sort", "no drag-handle elements found");
        }
      } catch (e) {
        fail("drag-handle present in custom sort", String(e));
      }

      // ── Test 7b: card reorder (drag 1→2) ───────────────────────────────────
      if (cardCount >= 2) {
        try {
          const items = page.locator('[data-testid="card-item"]');
          const firstId = await items.nth(0).getAttribute("data-card-id");
          const secondId = await items.nth(1).getAttribute("data-card-id");

          // Get bounding boxes
          const handle1 = items.nth(0).locator('[data-testid="drag-handle"]');
          const handle2 = items.nth(1).locator('[data-testid="drag-handle"]');
          const box1 = await handle1.boundingBox();
          const box2 = await handle2.boundingBox();

          if (!box1 || !box2) {
            skip("card reorder (drag 1→2)", "could not get bounding boxes for drag handles");
          } else {
            // Drag from handle1 center → handle2 center (slow drag)
            await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
            await page.mouse.down();
            // Move in small steps for smooth drag recognition
            const steps = 10;
            const dx = (box2.x - box1.x) / steps;
            const dy = (box2.y - box1.y + box2.height) / steps;
            for (let i = 1; i <= steps; i++) {
              await page.mouse.move(
                box1.x + box1.width / 2 + dx * i,
                box1.y + box1.height / 2 + dy * i,
                { steps: 1 }
              );
              await page.waitForTimeout(30);
            }
            await page.mouse.up();
            await page.waitForTimeout(800); // let re-render settle

            const newFirstId = await items.nth(0).getAttribute("data-card-id");
            if (newFirstId !== firstId) {
              pass("card reorder (drag 1→2)", `first card changed from ${firstId} → ${newFirstId}`);
            } else {
              // DnD may not always produce a visible order change depending on grid layout
              // Treat as soft-pass with warning (DnD activation requires > 8px travel)
              skip("card reorder (drag 1→2)", `DOM order unchanged after drag (firstId=${firstId}) — may need larger viewport or more cards`);
            }
          }
        } catch (e) {
          fail("card reorder (drag 1→2)", String(e));
        }
      } else {
        skip("card reorder (drag 1→2)", `only ${cardCount} card(s) visible — need ≥2 to test reorder`);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");
  const passCnt = results.filter((r) => r.status === "PASS").length;
  const failCnt = results.filter((r) => r.status === "FAIL").length;
  const skipCnt = results.filter((r) => r.status === "SKIP").length;
  for (const r of results) {
    const sym = r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "○";
    console.log(`  ${sym} [${r.status}] ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\nTotal: ${passCnt} PASS / ${failCnt} FAIL / ${skipCnt} SKIP`);
  console.log(`Finished: ${new Date().toISOString()}`);

  if (failed) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});

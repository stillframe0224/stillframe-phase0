#!/usr/bin/env node
/**
 * e2e_auth_storage_state.mjs
 *
 * Bootstraps an E2E browser session using the E2E=1 mock mode.
 * No service-role key, no real authentication required.
 *
 * Requirements:
 *   - Server must be running with E2E=1 build (localhost:3000 or BASE_URL)
 *   - __E2E_ALLOWED__ === true on the target host
 *
 * Usage:
 *   node scripts/e2e_auth_storage_state.mjs
 *   BASE_URL=http://localhost:3000 node scripts/e2e_auth_storage_state.mjs
 *
 * Output:
 *   .auth/storageState.json  — Playwright storageState for reuse in smoke tests
 *
 * This script is called automatically by app_ui_smoke.mjs when E2E=1 and
 * .auth/storageState.json does not exist.
 */

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const STATE_PATH = ".auth/storageState.json";
const TIMEOUT = 20_000;

async function main() {
  console.log(`[e2e-bootstrap] BASE_URL=${BASE_URL}`);
  console.log(`[e2e-bootstrap] Launching browser to verify E2E mock mode...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // Navigate to /app?e2e=1 — mock cards render if __E2E_ALLOWED__ is true
    await page.goto(`${BASE_URL}/app?e2e=1`, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await page.waitForTimeout(2000);

    // Verify E2E mock is active
    const e2eAllowed = await page.evaluate(() => (window).__E2E_ALLOWED__ === true);
    if (!e2eAllowed) {
      console.error("[e2e-bootstrap] FAIL: __E2E_ALLOWED__ is false.");
      console.error("[e2e-bootstrap] Ensure the server was built/started with E2E=1.");
      process.exit(1);
    }

    // Verify mock cards are rendered (6 expected)
    await page.waitForSelector('[data-testid="card-item"]', { timeout: 10_000 });
    const cardCount = await page.locator('[data-testid="card-item"]').count();
    if (cardCount < 1) {
      console.error(`[e2e-bootstrap] FAIL: Expected ≥1 mock card, got ${cardCount}.`);
      process.exit(1);
    }

    console.log(`[e2e-bootstrap] OK: E2E mock mode active, ${cardCount} mock cards visible.`);

    // Save storageState (cookies + localStorage for mock session)
    const storageState = await context.storageState();
    mkdirSync(dirname(STATE_PATH), { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(storageState, null, 2));
    console.log(`[e2e-bootstrap] storageState saved → ${STATE_PATH}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error("[e2e-bootstrap] FATAL:", e.message);
  process.exit(1);
});

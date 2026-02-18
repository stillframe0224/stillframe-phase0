#!/usr/bin/env node
/**
 * app_ui_smoke.mjs — /app UI acceptance smoke
 *
 * Two execution modes:
 *
 *   Mode A — Unauthenticated (default)
 *     node scripts/app_ui_smoke.mjs
 *     BASE_URL=https://stillframe-phase0.vercel.app node scripts/app_ui_smoke.mjs
 *     → Test 1 (/api/version) runs. Tests 2-7 SKIP (auth redirect expected).
 *
 *   Mode B — E2E mock (full suite)
 *     E2E=1 BASE_URL=http://localhost:3000 node scripts/app_ui_smoke.mjs
 *     → All 7 tests run using ?e2e=1 mock cards (no real auth needed).
 *     → Server must be built+started with E2E=1 (npm run build, npm start).
 *     → If .auth/storageState.json missing, auto-runs e2e_auth_storage_state.mjs first.
 *
 * Tests:
 *  1) GET /api/version returns 200 with sha
 *  2) /app loads and build-stamp is visible
 *  3) build-stamp sha matches /api/version sha
 *  4) Switching to "Custom order (drag)" keeps cards visible (≥1 card)
 *  5) cards-grid computed gap equals 8px
 *  6) MEMO chip click opens memo-modal on the first card
 *  7) drag-handle elements present; reorder if ≥2 cards (SKIP if <2, not FAIL)
 *
 * Exit code: 0 = all non-skipped tests PASS, 1 = any FAIL.
 */

import { chromium } from "@playwright/test";
import { existsSync } from "fs";
import { execFileSync } from "child_process";

const BASE_URL = process.env.BASE_URL ?? "https://stillframe-phase0.vercel.app";
const E2E_MODE = process.env.E2E === "1";
const STATE_PATH = ".auth/storageState.json";
const TIMEOUT = 30_000;

const results = [];
let failed = false;

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

/** Wait for server to be reachable (used in CI after `npm start` in background). */
async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(3_000) });
      if (res.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  if (process.env.CI && process.env.E2E !== "1") {
    console.error("E2E_REQUIRED_IN_CI: set E2E=1 for ui smoke in CI");
    process.exit(1);
  }

  console.log(`\n=== app_ui_smoke ===`);
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`Mode: ${E2E_MODE ? "E2E mock (E2E=1)" : "unauthenticated"}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // In CI, wait for the server to be ready before running any tests
  if (process.env.CI && E2E_MODE) {
    console.log("[smoke] Waiting for server to be ready...");
    const ready = await waitForServer(BASE_URL, 90_000);
    if (!ready) {
      console.error("[smoke] FATAL: Server not reachable after 90s");
      process.exit(1);
    }
    console.log("[smoke] Server is ready.\n");
  }

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

  // ── E2E mode bootstrap ────────────────────────────────────────────────────
  if (E2E_MODE && !existsSync(STATE_PATH)) {
    console.log("\n[smoke] E2E=1 but storageState missing — running bootstrap...");
    try {
      execFileSync("node", ["scripts/e2e_auth_storage_state.mjs"], {
        stdio: "inherit",
        env: { ...process.env },
      });
    } catch (e) {
      console.error("[smoke] Bootstrap failed:", e.message);
      process.exit(1);
    }
  }

  // ── Browser tests ─────────────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true });
  const contextOpts = {
    viewport: { width: 1280, height: 800 },
    ...(E2E_MODE && existsSync(STATE_PATH)
      ? { storageState: STATE_PATH }
      : {}),
  };
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  // URL to navigate: in E2E mode, always use ?e2e=1 to activate mock cards
  const appUrl = E2E_MODE ? `${BASE_URL}/app?e2e=1` : `${BASE_URL}/app`;

  try {
    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await page.waitForTimeout(2000);

    // ── Auth / E2E guard check ────────────────────────────────────────────
    const currentUrl = page.url();
    const currentPathname = new URL(currentUrl).pathname;
    const isAuthRedirect = currentPathname.startsWith("/auth/login");
    const hasLoginMarker = await page
      .locator("text=Sign in to save your thoughts")
      .first()
      .isVisible()
      .catch(() => false);

    if (isAuthRedirect || hasLoginMarker) {
      fail(
        "authenticated /app required for UI smoke",
        `AUTH_REQUIRED: reached login screen (path=${currentPathname})`
      );
      fail("/app loads and build-stamp is visible", "AUTH_REQUIRED");
      fail("build-stamp sha matches /api/version sha", "AUTH_REQUIRED");
      skip("sort dropdown switches to custom without losing cards", "AUTH_REQUIRED");
      skip("cards-grid computed gap is 8px", "AUTH_REQUIRED");
      skip("MEMO button opens memo-modal", "AUTH_REQUIRED");
      skip("drag-handle present", "AUTH_REQUIRED");
      skip("card reorder (drag 1→2)", "AUTH_REQUIRED");
      console.log("\n  [error] Auth required: UI acceptance checks not executed.");
      console.log("  [error] Provide authenticated state (e.g. E2E=1 + storageState) before running app_ui_smoke.\n");
    } else {
      // ── Test 2: build-stamp visible ─────────────────────────────────────
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

      // ── Test 3: build-stamp sha matches /api/version sha ────────────────
      if (versionSha && stampText) {
        const stampSha = stampText.replace("build:", "").trim();
        if (stampSha === versionSha) {
          pass("build-stamp sha matches /api/version sha", `both="${versionSha}"`);
        } else {
          // In local E2E mode, the local build SHA differs from production — treat as SKIP
          if (E2E_MODE && BASE_URL.includes("localhost")) {
            skip("build-stamp sha matches /api/version sha", `local build stamp="${stampSha}" vs production api="${versionSha}" (expected mismatch in local E2E mode)`);
          } else {
            fail("build-stamp sha matches /api/version sha", `stamp="${stampSha}" api="${versionSha}"`);
          }
        }
      } else {
        skip("build-stamp sha matches /api/version sha", "prerequisite test(s) failed — no sha to compare");
      }

      // Wait for cards to settle
      await page.waitForTimeout(1500);

      // ── Test 4: custom sort keeps cards ──────────────────────────────────
      let cardCountBefore = 0;
      let cardCountAfter = 0;
      try {
        const sortDropdown = page.locator('[data-testid="sort-dropdown"]');
        await sortDropdown.waitFor({ timeout: 10_000 });
        cardCountBefore = await page.locator('[data-testid="card-item"]').count();
        await sortDropdown.selectOption("custom");
        await page.waitForTimeout(1000);
        cardCountAfter = await page.locator('[data-testid="card-item"]').count();
        if (cardCountAfter >= 1) {
          pass("sort dropdown switches to custom without losing cards", `before=${cardCountBefore} after=${cardCountAfter}`);
        } else {
          fail("sort dropdown switches to custom without losing cards", `cards dropped to 0 (before=${cardCountBefore})`);
        }
      } catch (e) {
        fail("sort dropdown switches to custom without losing cards", String(e));
      }

      // ── Test 5: cards-grid gap is 8px ────────────────────────────────────
      try {
        const grid = page.locator('[data-testid="cards-grid"]').first();
        await grid.waitFor({ timeout: 5_000 });
        const gap = await grid.evaluate((el) => getComputedStyle(el).gap);
        const gapMatch = /^8px/.test(gap.trim());
        if (gapMatch) {
          pass("cards-grid computed gap is 8px", `gap="${gap.trim()}"`);
        } else {
          fail("cards-grid computed gap is 8px", `gap="${gap.trim()}" expected "8px"`);
        }
      } catch (e) {
        fail("cards-grid computed gap is 8px", String(e));
      }

      // ── Test 6: MEMO button opens memo-modal ─────────────────────────────
      try {
        const firstCard = page.locator('[data-testid="card-item"]').first();
        await firstCard.waitFor({ timeout: 5_000 });
        const memoBtn = firstCard.locator('[data-testid="chip-memo"]');
        await memoBtn.waitFor({ timeout: 5_000 });
        await memoBtn.click();
        const modal = page.locator('[data-testid="memo-modal"]');
        await modal.waitFor({ timeout: 5_000 });
        pass("MEMO button opens memo-modal", "modal visible after click");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      } catch (e) {
        fail("MEMO button opens memo-modal", String(e));
      }

      // ── Test 7a: drag-handle present ─────────────────────────────────────
      const cardCount = cardCountAfter;
      try {
        const handles = page.locator('[data-testid="drag-handle"]');
        const handleCount = await handles.count();
        if (handleCount >= 1) {
          pass("drag-handle present", `count=${handleCount}`);
        } else {
          fail("drag-handle present", "no drag-handle elements found");
        }
      } catch (e) {
        fail("drag-handle present", String(e));
      }

      // ── Test 7b: card reorder (pointer drag) ─────────────────────────────
      if (cardCount < 2) {
        if (E2E_MODE) {
          fail("card reorder (drag 1→2)", `REORDER_REQUIRED: need >=2 cards (got ${cardCount})`);
        } else {
          skip("card reorder (drag 1→2)", `only ${cardCount} card(s) — need ≥2`);
        }
      } else {
        try {
          await page.setViewportSize({ width: 1280, height: 800 });
          const items = page.locator('[data-testid="card-item"]');
          let reordered = false;
          let lastDetail = "";

          for (let attempt = 1; attempt <= 3; attempt++) {
            const firstId = await items.nth(0).getAttribute("data-card-id");
            const secondId = await items.nth(1).getAttribute("data-card-id");
            const sourceHandle = items.nth(0).locator('[data-testid="drag-handle"]');
            const targetCard = items.nth(1);
            await sourceHandle.scrollIntoViewIfNeeded();
            await targetCard.scrollIntoViewIfNeeded();
            await page.waitForTimeout(160);

            const handleBox = await sourceHandle.boundingBox();
            const cardBox = await targetCard.boundingBox();
            if (!handleBox || !cardBox) {
              throw new Error(`REORDER_REQUIRED: missing bbox (attempt=${attempt})`);
            }

            const startX = handleBox.x + handleBox.width / 2;
            const startY = handleBox.y + handleBox.height / 2;
            const targetX = cardBox.x + cardBox.width / 2 + 10;
            const targetY = cardBox.y + cardBox.height / 2 + 10;

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            // dnd-kit activationConstraint(distance:8) breaker.
            await page.mouse.move(startX, startY + 12, { steps: 5 });
            await page.mouse.move(targetX, targetY, { steps: 20 });
            await page.mouse.up();
            await page.waitForTimeout(700);

            const newFirstId = await items.nth(0).getAttribute("data-card-id");
            lastDetail =
              `attempt=${attempt} first=${firstId} second=${secondId} newFirst=${newFirstId} ` +
              `start=(${Math.round(startX)},${Math.round(startY)}) target=(${Math.round(targetX)},${Math.round(targetY)}) ` +
              `handle=(${Math.round(handleBox.x)},${Math.round(handleBox.y)},${Math.round(handleBox.width)},${Math.round(handleBox.height)}) ` +
              `card=(${Math.round(cardBox.x)},${Math.round(cardBox.y)},${Math.round(cardBox.width)},${Math.round(cardBox.height)})`;

            if (newFirstId && firstId && newFirstId !== firstId) {
              reordered = true;
              pass("card reorder (drag 1→2)", `${lastDetail} reordered=true`);
              break;
            }
          }

          if (!reordered) {
            if (E2E_MODE) {
              fail("card reorder (drag 1→2)", `REORDER_REQUIRED: no reorder after 3 attempts (${lastDetail})`);
            } else {
              skip("card reorder (drag 1→2)", `no reorder after retries (${lastDetail})`);
            }
          }
        } catch (e) {
          fail("card reorder (drag 1→2)", String(e));
        }
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
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

  if (E2E_MODE) {
    const allowSkipLabels = new Set();
    const disallowedSkips = results.filter(
      (r) => r.status === "SKIP" && !allowSkipLabels.has(r.label)
    );
    if (disallowedSkips.length > 0) {
      for (const s of disallowedSkips) {
        console.error(`[FAIL] disallowed skip in E2E mode: ${s.label} — ${s.detail ?? ""}`);
      }
      failed = true;
    }
  }

  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});

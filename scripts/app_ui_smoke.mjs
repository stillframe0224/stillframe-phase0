#!/usr/bin/env node
/**
 * app_ui_smoke.mjs — /app UI acceptance smoke
 *
 * Two execution modes:
 *
 *   Mode A — Unauthenticated (default)
 *     node scripts/app_ui_smoke.mjs
 *     BASE_URL=https://stillframe-phase0.vercel.app node scripts/app_ui_smoke.mjs
 *     → Test 1 (/api/version) runs. Tests 2-8 SKIP (auth redirect expected).
 *
 *   Mode B — E2E mock (full suite)
 *     E2E=1 BASE_URL=http://localhost:3000 node scripts/app_ui_smoke.mjs
 *     → All 8 tests run using ?e2e=1 mock cards (no real auth needed).
 *     → Server must be built+started with E2E=1 (npm run build, npm start).
 *     → If .auth/storageState.json missing, auto-runs e2e_auth_storage_state.mjs first.
 *
 * Tests:
 *  1) GET /api/version returns 200 with sha
 *  2) /app loads and build-stamp is visible
 *  3) build-stamp sha matches /api/version sha
 *  4) Switching to "Custom order (drag)" keeps cards visible (>=1 card)
 *  5) cards-grid computed gap equals 8px
 *  6) MEMO input is visible in list snippet + searchable + has-memo filter
 *  7) Memo backup: export→clear→import→verify (E2E=1 only)
 *  8) drag-handle elements present; reorder if >=2 cards (SKIP if <2, not FAIL)
 *
 * Exit code: 0 = all non-skipped tests PASS, 1 = any FAIL.
 *
 * On FAIL: diagnostic artifacts are saved to reports/ui-smoke/latest/
 *   screenshot.png        -- full-page screenshot at test end
 *   console.log           -- browser console messages (log/warn/error/info)
 *   pageerror.log         -- uncaught JS exceptions
 *   network_failures.json -- failed requests (status>=400 or requestfailed)
 *   summary.json          -- test results + metadata
 * Note: .auth/ storageState is never included in artifacts.
 */

import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { execFileSync } from "child_process";

const BASE_URL = process.env.BASE_URL ?? "https://stillframe-phase0.vercel.app";
const E2E_MODE = process.env.E2E === "1";
const STATE_PATH = ".auth/storageState.json";
const TIMEOUT = 30_000;
const ARTIFACT_DIR = "reports/ui-smoke/latest";

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

/** Mask query string from a URL to avoid leaking tokens in logs. */
function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.search) u.search = "?***";
    return u.toString();
  } catch {
    return url;
  }
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

/** Wait for server to be reachable (used in CI after 
> stillframe-phase0@1.0.0 start
> next start

▲ Next.js 16.1.6
- Local:         http://localhost:3000
- Network:       http://192.168.0.43:3000

✓ Starting... in background). */
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

/**
 * Save diagnostic artifacts to ARTIFACT_DIR.
 * Never writes .auth/ storageState or any credential file.
 */
async function saveDiagnostics(page, { consoleLogs, pageErrors, networkFailures }) {
  try {
    mkdirSync(ARTIFACT_DIR, { recursive: true });

    // screenshot
    try {
      await page.screenshot({ path: `${ARTIFACT_DIR}/screenshot.png`, fullPage: true });
      console.log(`[artifacts] screenshot.png saved`);
    } catch (e) {
      console.error(`[artifacts] screenshot failed: ${e.message}`);
    }

    // console.log
    const consoleText = consoleLogs
      .map((m) => `[${m.type}] ${m.text}`)
      .join("\n");
    writeFileSync(`${ARTIFACT_DIR}/console.log`, consoleText || "(no console messages)");
    console.log(`[artifacts] console.log saved (${consoleLogs.length} messages)`);

    // pageerror.log
    const pageErrorText = pageErrors
      .map((e) => `${e.timestamp} ${e.message}`)
      .join("\n");
    writeFileSync(`${ARTIFACT_DIR}/pageerror.log`, pageErrorText || "(no page errors)");
    console.log(`[artifacts] pageerror.log saved (${pageErrors.length} errors)`);

    // network_failures.json
    writeFileSync(
      `${ARTIFACT_DIR}/network_failures.json`,
      JSON.stringify(networkFailures, null, 2)
    );
    console.log(`[artifacts] network_failures.json saved (${networkFailures.length} failures)`);

    // summary.json
    const summary = {
      timestamp: new Date().toISOString(),
      base_url: maskUrl(BASE_URL),
      e2e_mode: E2E_MODE,
      results,
      pass: results.filter((r) => r.status === "PASS").length,
      fail: results.filter((r) => r.status === "FAIL").length,
      skip: results.filter((r) => r.status === "SKIP").length,
    };
    writeFileSync(`${ARTIFACT_DIR}/summary.json`, JSON.stringify(summary, null, 2));
    console.log(`[artifacts] summary.json saved`);

    console.log(`\n[artifacts] All diagnostics → ${ARTIFACT_DIR}/`);
  } catch (e) {
    console.error(`[artifacts] Failed to save diagnostics: ${e.message}`);
  }
}

async function main() {
  if (process.env.CI && process.env.E2E !== "1") {
    console.error("E2E_REQUIRED_IN_CI: set E2E=1 for ui smoke in CI");
    process.exit(1);
  }

  console.log(`\n=== app_ui_smoke ===`);
  console.log(`BASE_URL: ${maskUrl(BASE_URL)}`);
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
    acceptDownloads: true,
    ...(E2E_MODE && existsSync(STATE_PATH)
      ? { storageState: STATE_PATH }
      : {}),
  };
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  // ── Diagnostic collectors (always active) ─────────────────────────────────
  const consoleLogs = [];
  const pageErrors = [];
  const networkFailures = [];

  page.on("console", (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ timestamp: new Date().toISOString(), message: err.message });
  });
  page.on("requestfailed", (req) => {
    networkFailures.push({
      type: "requestfailed",
      url: maskUrl(req.url()),
      method: req.method(),
      failure: req.failure()?.errorText ?? "unknown",
    });
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      networkFailures.push({
        type: "response_error",
        url: maskUrl(res.url()),
        status: res.status(),
        method: res.request().method(),
      });
    }
  });

  // URL to navigate: in E2E mode, always use ?e2e=1 to activate mock cards
  const appUrl = E2E_MODE ? `${BASE_URL}/app?e2e=1` : `${BASE_URL}/app`;

  try {
    // Navigate — catch connection errors so diagnostics are always saved
    let gotoFailed = false;
    try {
      await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    } catch (e) {
      gotoFailed = true;
      fail("/app page.goto failed", String(e));
      fail("/app loads and build-stamp is visible", "GOTO_FAILED");
      fail("build-stamp sha matches /api/version sha", "GOTO_FAILED");
      skip("sort dropdown switches to custom without losing cards", "GOTO_FAILED");
      skip("cards-grid computed gap is 8px", "GOTO_FAILED");
      skip("MEMO button opens memo-modal", "GOTO_FAILED");
      skip("memo snippet shows saved text", "GOTO_FAILED");
      skip("search matches memo text", "GOTO_FAILED");
      skip("has memo filter narrows cards", "GOTO_FAILED");
      skip("memo backup: export JSON download", "GOTO_FAILED");
      skip("memo backup: clear removes snippets", "GOTO_FAILED");
      skip("memo backup: import restores snippets", "GOTO_FAILED");
      skip("memo backup: search matches restored memo", "GOTO_FAILED");
      skip("memo backup: has-memo filter after restore", "GOTO_FAILED");
      skip("card reorder (drag 1->2)", "GOTO_FAILED");
      skip("memo-modal fits viewport", "GOTO_FAILED");
    }

    if (!gotoFailed) {
      await page.waitForTimeout(2000);

      // ── Auth / E2E guard check ────────────────────────────────────────
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
        skip("memo snippet shows saved text", "AUTH_REQUIRED");
        skip("search matches memo text", "AUTH_REQUIRED");
        skip("has memo filter narrows cards", "AUTH_REQUIRED");
        skip("memo backup: export JSON download", "AUTH_REQUIRED");
        skip("memo backup: clear removes snippets", "AUTH_REQUIRED");
        skip("memo backup: import restores snippets", "AUTH_REQUIRED");
        skip("memo backup: search matches restored memo", "AUTH_REQUIRED");
        skip("memo backup: has-memo filter after restore", "AUTH_REQUIRED");
        skip("card reorder (drag 1->2)", "AUTH_REQUIRED");
        skip("memo-modal fits viewport", "AUTH_REQUIRED");
        console.log("\n  [error] Auth required: UI acceptance checks not executed.");
        console.log("  [error] Provide authenticated state (e.g. E2E=1 + storageState) before running app_ui_smoke.\n");
      } else {
        // ── Test 2: build-stamp visible ───────────────────────────────
        let stampText = null;
        try {
          const stamp = page.locator("[data-testid=\"build-stamp\"]");
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

        // ── Test 3: build-stamp sha matches /api/version sha ──────────
        if (versionSha && stampText) {
          const stampSha = stampText.replace("build:", "").trim();
          if (stampSha === versionSha) {
            pass("build-stamp sha matches /api/version sha", `both="${versionSha}"`);
          } else {
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

        // ── Test 4: custom sort keeps cards ────────────────────────────
        let cardCountBefore = 0;
        let cardCountAfter = 0;
        try {
          const sortDropdown = page.locator("[data-testid=\"sort-dropdown\"]");
          await sortDropdown.waitFor({ timeout: 10_000 });
          cardCountBefore = await page.locator("[data-testid=\"card-item\"]").count();
          await sortDropdown.selectOption("custom");
          await page.waitForTimeout(1000);
          cardCountAfter = await page.locator("[data-testid=\"card-item\"]").count();
          if (cardCountAfter >= 1) {
            pass("sort dropdown switches to custom without losing cards", `before=${cardCountBefore} after=${cardCountAfter}`);
          } else {
            fail("sort dropdown switches to custom without losing cards", `cards dropped to 0 (before=${cardCountBefore})`);
          }
        } catch (e) {
          fail("sort dropdown switches to custom without losing cards", String(e));
        }

        // ── Test 5: cards-grid gap is 8px ──────────────────────────────
        try {
          const grid = page.locator("[data-testid=\"cards-grid\"]").first();
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

        // ── Test 6: MEMO button opens memo-modal ───────────────────────
        try {
          const memoKeyword = `smoke-memo-${Date.now().toString().slice(-6)}`;
          const firstCard = page.locator("[data-testid=\"card-item\"]").first();
          await firstCard.waitFor({ timeout: 5_000 });
          const memoBtn = firstCard.locator("[data-testid=\"chip-memo\"]");
          await memoBtn.waitFor({ timeout: 5_000 });
          await memoBtn.click();
          const modal = page.locator("[data-testid=\"memo-modal\"]");
          await modal.waitFor({ timeout: 5_000 });
          pass("MEMO button opens memo-modal", "modal visible after click");

          const memoTextarea = page.locator("[data-testid=\"memo-textarea\"]");
          await memoTextarea.fill(`${memoKeyword} useful`);
          await page.locator("[data-testid=\"memo-save\"]").click();
          await page.waitForTimeout(500);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);

          const memoSnippet = firstCard.locator("[data-testid=\"memo-snippet\"]");
          await memoSnippet.waitFor({ timeout: 5_000 });
          const memoSnippetText = ((await memoSnippet.textContent()) || "").toLowerCase();
          if (memoSnippetText.includes(memoKeyword)) {
            pass("memo snippet shows saved text", `snippet includes "${memoKeyword}"`);
          } else {
            fail("memo snippet shows saved text", `snippet does not include "${memoKeyword}"`);
          }

          const searchInput = page.locator("[data-testid=\"search-input\"]");
          await searchInput.fill(memoKeyword);
          await page.waitForTimeout(500);
          const searchCount = await page.locator("[data-testid=\"card-item\"]").count();
          if (searchCount >= 1) {
            pass("search matches memo text", `count=${searchCount}`);
          } else {
            fail("search matches memo text", "count=0");
          }

          await searchInput.fill("");
          await page.waitForTimeout(300);
          const allCount = await page.locator("[data-testid=\"card-item\"]").count();
          const hasMemoToggle = page.locator("[data-testid=\"filter-has-memo\"]");
          await hasMemoToggle.click();
          await page.waitForTimeout(500);
          const memoOnlyCount = await page.locator("[data-testid=\"card-item\"]").count();
          if (memoOnlyCount >= 1 && (allCount <= 1 || memoOnlyCount < allCount)) {
            pass("has memo filter narrows cards", `all=${allCount} memoOnly=${memoOnlyCount}`);
          } else {
            fail("has memo filter narrows cards", `all=${allCount} memoOnly=${memoOnlyCount}`);
          }
          await hasMemoToggle.click();
          await page.waitForTimeout(300);
        } catch (e) {
          fail("MEMO button opens memo-modal", String(e));
        }

        // ── Test 7: Memo backup (export → clear → import) ──────────────
        // Only run in E2E mode (requires local server + mock cards with notes).
        if (!E2E_MODE) {
          skip("memo backup: export JSON download", "E2E_REQUIRED");
          skip("memo backup: clear removes snippets", "E2E_REQUIRED");
          skip("memo backup: import restores snippets", "E2E_REQUIRED");
          skip("memo backup: search matches restored memo", "E2E_REQUIRED");
          skip("memo backup: has-memo filter after restore", "E2E_REQUIRED");
        } else {
          try {
            // ① Export: click memo-export, capture download, validate JSON
            const exportBtn = page.locator("[data-testid=\"memo-export\"]");
            await exportBtn.waitFor({ timeout: 5_000 });

            const [download] = await Promise.all([
              page.waitForEvent("download", { timeout: 10_000 }),
              exportBtn.click(),
            ]);
            const downloadPath = await download.path();
            if (!downloadPath) throw new Error("download.path() returned null");

            const exportedJson = JSON.parse(readFileSync(downloadPath, "utf8"));
            if (exportedJson.schema !== "stillframe-memos-v1") {
              fail("memo backup: export JSON download", `bad schema: ${exportedJson.schema}`);
            } else if (typeof exportedJson.notes !== "object") {
              fail("memo backup: export JSON download", "notes field is not an object");
            } else {
              pass("memo backup: export JSON download", `schema=ok notes=${Object.keys(exportedJson.notes).length}`);
            }

            // ② Clear: click memo-clear, verify memo-snippet gone from first card
            const clearBtn = page.locator("[data-testid=\"memo-clear\"]");
            await clearBtn.waitFor({ timeout: 5_000 });
            await clearBtn.click();
            await page.waitForTimeout(1000);

            const firstCardAfterClear = page.locator("[data-testid=\"card-item\"]").first();
            const snippetAfterClear = firstCardAfterClear.locator("[data-testid=\"memo-snippet\"]");
            const snippetVisibleAfterClear = await snippetAfterClear.isVisible().catch(() => false);
            if (!snippetVisibleAfterClear) {
              pass("memo backup: clear removes snippets", "memo-snippet no longer visible");
            } else {
              fail("memo backup: clear removes snippets", "memo-snippet still visible after clear");
            }

            // ③ Import: use setInputFiles on the hidden file input (state: "attached" since it's display:none)
            const importInput = page.locator("[data-testid=\"memo-import-input\"]");
            await importInput.waitFor({ state: "attached", timeout: 5_000 });
            await importInput.setInputFiles(downloadPath);
            await page.waitForTimeout(800);

            // ④ Verify snippet restored on first card that had a note
            const firstCardId = await page.locator("[data-testid=\"card-item\"]").first().getAttribute("data-card-id");
            const hadNote = firstCardId && exportedJson.notes[firstCardId];
            if (hadNote) {
              const snippetAfterImport = page.locator("[data-testid=\"card-item\"]").first().locator("[data-testid=\"memo-snippet\"]");
              await snippetAfterImport.waitFor({ timeout: 5_000 });
              pass("memo backup: import restores snippets", "memo-snippet visible after import");
            } else {
              // No note on first card in export — check any card has snippet
              const anySnippet = page.locator("[data-testid=\"memo-snippet\"]").first();
              const anyVisible = await anySnippet.isVisible().catch(() => false);
              if (anyVisible) {
                pass("memo backup: import restores snippets", "memo-snippet visible on some card after import");
              } else {
                fail("memo backup: import restores snippets", "no memo-snippet visible after import");
              }
            }

            // ⑤ Search matches restored memo keyword
            const restoredMemoKeyword = Object.values(exportedJson.notes)[0];
            if (restoredMemoKeyword && typeof restoredMemoKeyword === "string") {
              const keyword = restoredMemoKeyword.split(" ")[0].slice(0, 20);
              const searchInput2 = page.locator("[data-testid=\"search-input\"]");
              await searchInput2.fill(keyword);
              await page.waitForTimeout(500);
              const searchCount2 = await page.locator("[data-testid=\"card-item\"]").count();
              if (searchCount2 >= 1) {
                pass("memo backup: search matches restored memo", `count=${searchCount2} keyword="${keyword}"`);
              } else {
                fail("memo backup: search matches restored memo", `count=0 keyword="${keyword}"`);
              }
              await searchInput2.fill("");
              await page.waitForTimeout(300);
            } else {
              skip("memo backup: search matches restored memo", "no notes in export to search");
            }

            // ⑥ Has-memo filter shows at least 1 card
            const hasMemoToggle2 = page.locator("[data-testid=\"filter-has-memo\"]");
            await hasMemoToggle2.click();
            await page.waitForTimeout(500);
            const memoOnlyCount2 = await page.locator("[data-testid=\"card-item\"]").count();
            if (memoOnlyCount2 >= 1) {
              pass("memo backup: has-memo filter after restore", `count=${memoOnlyCount2}`);
            } else {
              fail("memo backup: has-memo filter after restore", "count=0 — no cards with memos after import");
            }
            await hasMemoToggle2.click();
            await page.waitForTimeout(300);
          } catch (e) {
            fail("memo backup: unexpected error", String(e));
          }
        }

        // ── Test 8: card reorder (full-card drag, no handle) ──────────
        // Cards are draggable from their root (.thought-card) — no handle needed.
        const cardCount = cardCountAfter;
        if (cardCount < 2) {
          if (E2E_MODE) {
            fail("card reorder (drag 1->2)", `REORDER_REQUIRED: need >=2 cards (got ${cardCount})`);
          } else {
            skip("card reorder (drag 1->2)", `only ${cardCount} card(s) — need >=2`);
          }
        } else {
          try {
            await page.setViewportSize({ width: 1280, height: 800 });
            const items = page.locator("[data-testid=\"card-item\"]");
            let reordered = false;
            let lastDetail = "";

            for (let attempt = 1; attempt <= 3; attempt++) {
              const firstId = await items.nth(0).getAttribute("data-card-id");
              const secondId = await items.nth(1).getAttribute("data-card-id");
              // Full-card drag: use .thought-card root (where dnd-kit listeners live)
              const sourceCard = items.nth(0).locator(".thought-card").first();
              const targetCard = items.nth(1).locator(".thought-card").first();
              await sourceCard.scrollIntoViewIfNeeded();
              await targetCard.scrollIntoViewIfNeeded();
              await page.waitForTimeout(160);

              const sourceBox = await sourceCard.boundingBox();
              const cardBox = await targetCard.boundingBox();
              if (!sourceBox || !cardBox) {
                throw new Error(`REORDER_REQUIRED: missing bbox (attempt=${attempt})`);
              }

              // Start from upper-centre of source (above image link / interactive chips)
              const startX = sourceBox.x + sourceBox.width / 2;
              const startY = sourceBox.y + Math.min(20, sourceBox.height * 0.15);
              const targetX = cardBox.x + cardBox.width / 2;
              const targetY = cardBox.y + cardBox.height * 0.75;

              await page.mouse.move(startX, startY);
              await page.mouse.down();
              // Break dnd-kit activationConstraint(distance:8)
              await page.mouse.move(startX, startY + 12, { steps: 5 });
              await page.mouse.move(targetX, targetY, { steps: 20 });
              await page.mouse.up();
              await page.waitForTimeout(700);

              const newFirstId = await items.nth(0).getAttribute("data-card-id");
              lastDetail =
                `attempt=${attempt} first=${firstId} second=${secondId} newFirst=${newFirstId} ` +
                `start=(${Math.round(startX)},${Math.round(startY)}) target=(${Math.round(targetX)},${Math.round(targetY)}) ` +
                `source=(${Math.round(sourceBox.x)},${Math.round(sourceBox.y)},${Math.round(sourceBox.width)},${Math.round(sourceBox.height)}) ` +
                `card=(${Math.round(cardBox.x)},${Math.round(cardBox.y)},${Math.round(cardBox.width)},${Math.round(cardBox.height)})`;

              if (newFirstId && firstId && newFirstId !== firstId) {
                reordered = true;
                pass("card reorder (drag 1->2)", `${lastDetail} reordered=true`);
                break;
              }
            }

            if (!reordered) {
              if (E2E_MODE) {
                fail("card reorder (drag 1->2)", `REORDER_REQUIRED: no reorder after 3 attempts (${lastDetail})`);
              } else {
                skip("card reorder (drag 1->2)", `no reorder after retries (${lastDetail})`);
              }
            }
          } catch (e) {
            fail("card reorder (drag 1->2)", String(e));
          }
        }

        // ── Test 9: MEMO modal fits viewport ───────────────────────────
        try {
          // Open a MEMO modal and verify bounding box fits within viewport height
          const firstCard = page.locator("[data-testid=\"card-item\"]").first();
          const memoChip = firstCard.locator("[data-testid=\"chip-memo\"]");
          await memoChip.click();
          await page.waitForTimeout(400);
          const modal = page.locator("[data-testid=\"memo-modal\"]");
          await modal.waitFor({ state: "visible", timeout: 3000 });
          const vp = page.viewportSize();
          const modalBox = await modal.boundingBox();
          if (!vp || !modalBox) {
            skip("memo-modal fits viewport", "could not measure viewport or modal");
          } else {
            const overflows = modalBox.y + modalBox.height > vp.height + 2; // 2px tolerance
            if (!overflows) {
              pass("memo-modal fits viewport", `modal h=${Math.round(modalBox.height)} vp h=${vp.height}`);
            } else {
              fail("memo-modal fits viewport", `modal bottom=${Math.round(modalBox.y + modalBox.height)} exceeds vp=${vp.height}`);
            }
          }
          // Close modal
          await page.keyboard.press("Escape");
          await page.waitForTimeout(200);
        } catch (e) {
          skip("memo-modal fits viewport", `could not open modal: ${String(e)}`);
        }
      }
    }
  } finally {
    // ── Save diagnostics on failure ───────────────────────────────────────
    if (failed) {
      console.log("\n[artifacts] FAIL detected — saving diagnostics...");
      await saveDiagnostics(page, { consoleLogs, pageErrors, networkFailures });
    }
    await context.close();
    await browser.close();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");
  const passCnt = results.filter((r) => r.status === "PASS").length;
  const failCnt = results.filter((r) => r.status === "FAIL").length;
  const skipCnt = results.filter((r) => r.status === "SKIP").length;
  for (const r of results) {
    const sym = r.status === "PASS" ? "checkmark" : r.status === "FAIL" ? "x" : "o";
    console.log(`  ${sym} [${r.status}] ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\nTotal: ${passCnt} PASS / ${failCnt} FAIL / ${skipCnt} SKIP`);
  console.log(`Finished: ${new Date().toISOString()}`);

  if (failed) {
    console.log(`\n[artifacts] Diagnostics saved -> ${ARTIFACT_DIR}/`);
    console.log(`  ${ARTIFACT_DIR}/screenshot.png`);
    console.log(`  ${ARTIFACT_DIR}/console.log`);
    console.log(`  ${ARTIFACT_DIR}/pageerror.log`);
    console.log(`  ${ARTIFACT_DIR}/network_failures.json`);
    console.log(`  ${ARTIFACT_DIR}/summary.json`);
  }

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

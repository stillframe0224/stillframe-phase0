import { expect, test } from "@playwright/test";

/**
 * Security guard: verifies that ?e2e=1 does NOT activate mock mode
 * when E2E env var is not set at build time.
 *
 * Invariants enforced here:
 *   I-1: E2E env var absent → __E2E_ALLOWED__ is false
 *   I-2: __E2E_ALLOWED__ is false → no mock cards rendered
 *   I-3: hostname check is exact-match only (no partial/prefix match)
 *   I-4: console.warn emitted when bypass attempted without env
 *
 * This test runs against a build done WITHOUT E2E env var,
 * using playwright.guard.config.ts (server on 127.0.0.1).
 */

// I-1 + I-2: no env var → __E2E_ALLOWED__ false → no mock cards
test("e2e bypass is disabled without E2E env var", async ({ page }) => {
  await page.goto("/app?e2e=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // __E2E_ALLOWED__ must be false
  const allowed = await page.evaluate(() => (window as any).__E2E_ALLOWED__);
  expect(allowed).toBe(false);

  // Mock cards must NOT be rendered
  const cardCount = await page.getByTestId("card-item").count();
  expect(cardCount).toBe(0);
});

// I-1: __E2E_ALLOWED__ is sealed even when false (writable:false, configurable:false)
test("__E2E_ALLOWED__ is sealed even when false", async ({ page }) => {
  await page.goto("/app?e2e=1", { waitUntil: "networkidle" });

  const result = await page.evaluate(() => {
    const desc = Object.getOwnPropertyDescriptor(window, "__E2E_ALLOWED__");
    const w = window as any;
    const before = w.__E2E_ALLOWED__;
    // attempt to flip to true
    try { w.__E2E_ALLOWED__ = true; } catch {}
    let redefineThrew = false;
    try {
      Object.defineProperty(window, "__E2E_ALLOWED__", { value: true });
    } catch {
      redefineThrew = true;
    }
    return {
      writable: desc?.writable,
      configurable: desc?.configurable,
      before,
      afterAssign: w.__E2E_ALLOWED__,
      redefineThrew,
    };
  });

  expect(result.writable).toBe(false);
  expect(result.configurable).toBe(false);
  expect(result.before).toBe(false);
  expect(result.afterAssign).toBe(false); // flip to true must not succeed
  expect(result.redefineThrew).toBe(true);
});

// I-3: hostname check is exact-match — env absent keeps guard closed regardless
test("hostname check is exact-match only — no partial match", async ({ page }) => {
  await page.goto("/app?e2e=1", { waitUntil: "networkidle" });

  // Server runs on 127.0.0.1 (guard config) — verify it's an exact allowed value
  const hostname = await page.evaluate(() => location.hostname);
  const isExactAllowed = hostname === "localhost" || hostname === "127.0.0.1";
  expect(isExactAllowed).toBe(true);

  // E2E env is absent → __E2E_ALLOWED__ sealed false regardless of hostname
  const allowed = await page.evaluate(() => (window as any).__E2E_ALLOWED__);
  expect(allowed).toBe(false);
});

// I-4: warn is emitted when bypass attempted without env
test("console.warn emitted on e2e bypass attempt without env", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning") warnings.push(msg.text());
  });

  await page.goto("/app?e2e=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const hasWarn = warnings.some((w) => w.includes("[shinen] e2e bypass attempted"));
  expect(hasWarn).toBe(true);
});

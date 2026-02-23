import { expect, test } from "@playwright/test";

test("LP CTAs are visible and clickable", async ({ page }) => {
  await page.goto("/");

  const earlyAccess = page.getByTestId("cta-early-access").first();
  const pricing = page.getByTestId("cta-pricing").first();
  const waitlist = page.getByTestId("cta-waitlist");

  await expect(earlyAccess).toBeVisible();
  await expect(pricing).toBeVisible();
  await expect(waitlist).toBeVisible();

  await earlyAccess.click({ trial: true });
  // pricing CTA may be disabled when checkout URL is not configured
  if (!await pricing.isDisabled()) {
    await pricing.click({ trial: true });
  }
  await waitlist.click({ trial: true });
});

test("/app shinen canvas renders cards in e2e mode", async ({ page }) => {
  await page.goto("/app?e2e=1");

  const root = page.getByTestId("shinen-root");
  await expect(root).toBeVisible();

  const cards = page.getByTestId("card-item");
  await expect(cards.first()).toBeVisible();

  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test("__E2E_ALLOWED__ is sealed: readonly, non-configurable, non-deletable", async ({ page }) => {
  await page.goto("/app?e2e=1", { waitUntil: "networkidle" });

  const result = await page.evaluate(() => {
    const w = window as any;
    const desc = Object.getOwnPropertyDescriptor(window, "__E2E_ALLOWED__");

    // 1) assignment must not change value
    const before = w.__E2E_ALLOWED__;
    try { w.__E2E_ALLOWED__ = false; } catch {}
    const afterAssign = w.__E2E_ALLOWED__;

    // 2) delete must not remove property
    let deleteThrew = false;
    try { delete w.__E2E_ALLOWED__; } catch { deleteThrew = true; }
    const afterDelete = w.__E2E_ALLOWED__;

    // 3) redefine must not succeed
    let redefineThrew = false;
    try { Object.defineProperty(window, "__E2E_ALLOWED__", { value: false }); } catch { redefineThrew = true; }
    const afterRedefine = w.__E2E_ALLOWED__;

    return {
      writable: desc?.writable,
      configurable: desc?.configurable,
      before,
      afterAssign,
      afterDelete,
      afterRedefine,
      deleteThrew,
      redefineThrew,
    };
  });

  // Property descriptor
  expect(result.writable).toBe(false);
  expect(result.configurable).toBe(false);

  // Value unchanged through all attacks
  expect(result.before).toBe(true);
  expect(result.afterAssign).toBe(true);
  expect(result.afterDelete).toBe(true);
  expect(result.afterRedefine).toBe(true);

  // Redefine must throw (configurable:false enforced)
  expect(result.redefineThrew).toBe(true);
});

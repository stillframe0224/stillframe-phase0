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

test("/app grid is aligned and has no horizontal overflow", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1");

  const grid = page.getByTestId("card-grid");
  const cards = page.getByTestId("card-item");

  await expect(grid).toBeVisible();
  await expect(cards).toHaveCount(6);

  const hasOverflow = await grid.evaluate((el) => {
    return el.scrollWidth > el.clientWidth + 2;
  });
  expect(hasOverflow).toBeFalsy();

  const widths = await cards.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().width))
  );
  const min = Math.min(...widths);
  const max = Math.max(...widths);
  expect(max - min).toBeLessThanOrEqual(8);
});

test("memo opens and persists after reload", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1");

  const firstCard = page.getByTestId("card-item").first();
  const firstCardId = await firstCard.getAttribute("data-card-id");
  expect(firstCardId).toBeTruthy();

  await firstCard.getByTestId("chip-memo").click();
  const memoTextarea = page.getByTestId("memo-textarea");
  const memoSave = page.getByTestId("memo-save");
  const memo = `memo smoke ${Date.now()}`;

  await memoTextarea.fill(memo);
  await memoSave.click();

  await page.reload();
  await page.getByTestId("card-item").first().getByTestId("chip-memo").click();
  await expect(page.getByTestId("memo-textarea")).toHaveValue(memo);

  const localMemo = await page.evaluate((cardId) => {
    if (!cardId) return null;
    return localStorage.getItem(`card:memo:${cardId}`);
  }, firstCardId);
  expect(localMemo).toBe(memo);
});

test("memo dialog keyboard a11y: autofocus, trap, esc, focus restore", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1");

  const firstCard = page.getByTestId("card-item").first();
  const memoChip = firstCard.getByTestId("chip-memo");

  await memoChip.click();

  // dialog semantics
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");

  // autofocus to textarea
  const textarea = page.getByTestId("memo-textarea");
  await expect(textarea).toBeFocused();

  // focus trap: Tab cycles within dialog
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const inDialog = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(inDialog).toBeTruthy();
  }

  // reverse tab also stays inside
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Shift+Tab");
    const inDialog = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(inDialog).toBeTruthy();
  }

  // ESC closes dialog and focus restores to trigger chip
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(memoChip).toBeFocused();
});

test("__E2E_ALLOWED__ is sealed: readonly, non-configurable, non-deletable", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1", { waitUntil: "networkidle" });

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

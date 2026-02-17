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
  await pricing.click({ trial: true });
  await waitlist.click({ trial: true });
});

test("/app grid is aligned and has no horizontal overflow", async ({ page }) => {
  await page.goto("/app?e2e=1");

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
  await page.goto("/app?e2e=1");

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

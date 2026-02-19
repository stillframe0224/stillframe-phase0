import { expect, test } from "@playwright/test";

test("e2e mode auto-forces list view (tunnel safety net)", async ({ page }) => {
  await page.goto("/app?e2e=1");

  // e2eMode auto-forces list view — verify grid is visible (backwards compat)
  const grid = page.getByTestId("cards-grid");
  await expect(grid).toBeVisible();

  // Even with explicit view=tunnel, e2eMode takes priority → still list view
  await page.goto("/app?e2e=1&view=tunnel");
  await expect(grid).toBeVisible();
});

test("?view=list shows the original grid layout with 6 cards", async ({ page }) => {
  await page.goto("/app?e2e=1&view=list");

  const grid = page.getByTestId("cards-grid");
  await expect(grid).toBeVisible();

  const cards = page.getByTestId("card-item");
  await expect(cards).toHaveCount(6);
});

test("view=list fallback preserves card interactivity", async ({ page }) => {
  await page.goto("/app?e2e=1&view=list");

  // Cards render
  const cards = page.getByTestId("card-item");
  await expect(cards).toHaveCount(6);

  // First card's memo chip is clickable
  const firstCard = cards.first();
  const memoChip = firstCard.getByTestId("chip-memo");
  await expect(memoChip).toBeVisible();
  await memoChip.click();

  // Memo dialog opens
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
});

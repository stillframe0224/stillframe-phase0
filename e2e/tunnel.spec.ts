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

test("?view=list navigated twice keeps grid visible", async ({ page }) => {
  // Navigate to list view, then navigate to list again — should stay stable
  await page.goto("/app?e2e=1&view=list");
  const grid = page.getByTestId("cards-grid");
  await expect(grid).toBeVisible();

  // Navigate to list explicitly a second time (simulates URL param roundtrip)
  await page.goto("/app?e2e=1&view=list");
  await expect(grid).toBeVisible();

  // Cards still present and count is correct
  const cards = page.getByTestId("card-item");
  await expect(cards).toHaveCount(6);
});

test("tunnel localStorage key is written after state initializes", async ({ page }) => {
  // Clear any stale tunnel state before the test
  await page.goto("/app?e2e=1&view=list");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("stillframe.tunnel.v1:")) {
        localStorage.removeItem(key);
      }
    }
  });

  // Reload so the tunnel store initializes from a clean slate
  await page.reload();
  await page.getByTestId("cards-grid").waitFor({ state: "visible" });

  // Wait for the debounced save (300ms) to fire, with some margin
  await page.waitForTimeout(600);

  // Tunnel localStorage key should now exist
  const tunnelKey = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("stillframe.tunnel.v1:")) return key;
    }
    return null;
  });
  expect(tunnelKey).not.toBeNull();

  // The stored value must be valid JSON with positions and camera
  const stored = await page.evaluate((k) => {
    const raw = localStorage.getItem(k!);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return "INVALID_JSON";
    }
  }, tunnelKey);
  expect(stored).not.toBe("INVALID_JSON");
  expect(stored).not.toBeNull();
  expect(typeof stored.positions).toBe("object");
  expect(typeof stored.camera).toBe("object");
});

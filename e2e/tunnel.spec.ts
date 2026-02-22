import { expect, test } from "@playwright/test";

// Skipped: tunnel UI removed in v17 rewrite
test.skip("e2e mode auto-forces list view (tunnel safety net)", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1");

  // e2eMode auto-forces list view — verify grid is visible (backwards compat)
  const grid = page.getByTestId("cards-grid");
  await expect(grid).toBeVisible();

  // Even with explicit view=tunnel, e2eMode takes priority → still list view
  await page.goto("/app?e2e=1&legacy=1&view=tunnel");
  await expect(grid).toBeVisible();
});

test.skip("?view=list shows the original grid layout with 6 cards", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1&view=list");

  const grid = page.getByTestId("cards-grid");
  await expect(grid).toBeVisible();

  const cards = page.getByTestId("card-item");
  await expect(cards).toHaveCount(6);
});

test.skip("view=list fallback preserves card interactivity", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1&view=list");

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

test.skip("?view=list navigated twice keeps grid visible", async ({ page }) => {
  // Navigate to list view, then navigate to list again — should stay stable
  await page.goto("/app?e2e=1&legacy=1&view=list");
  const grid = page.getByTestId("cards-grid");
  await expect(grid).toBeVisible();

  // Navigate to list explicitly a second time (simulates URL param roundtrip)
  await page.goto("/app?e2e=1&legacy=1&view=list");
  await expect(grid).toBeVisible();

  // Cards still present and count is correct
  const cards = page.getByTestId("card-item");
  await expect(cards).toHaveCount(6);
});

test.skip("tunnel localStorage: valid state survives reload, corrupt state is recoverable", async ({ page }) => {
  // Load the app to get a valid origin for localStorage access
  await page.goto("/app?e2e=1&legacy=1&view=list");
  await page.getByTestId("cards-grid").waitFor({ state: "visible" });

  // Write a well-formed tunnel state directly — simulates what useTunnelStore writes
  const STORAGE_KEY = "stillframe.tunnel.v1:e2e-user";
  const validState = {
    positions: { "card-1": { x: 100, y: 200, z: 0 } },
    camera: { x: 0, y: 0, zoom: 1 },
    layout: "scatter",
  };
  await page.evaluate(
    ([key, val]) => localStorage.setItem(key, JSON.stringify(val)),
    [STORAGE_KEY, validState] as [string, typeof validState]
  );

  // Reload — list view keeps the key alive (no TunnelCanvas to overwrite it)
  await page.reload();
  await page.getByTestId("cards-grid").waitFor({ state: "visible" });

  // Key must still exist (nothing should delete it)
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY
  );
  expect(raw).not.toBeNull();

  // Stored JSON must parse correctly with expected shape
  const stored = JSON.parse(raw!);
  expect(typeof stored.positions).toBe("object");
  expect(typeof stored.camera).toBe("object");
  expect(stored.camera.zoom).toBe(1);

  // Now write corrupt JSON — simulates a truncated write or version mismatch
  await page.evaluate(
    (key) => localStorage.setItem(key, '{"positions":null,"camera":42}'),
    STORAGE_KEY
  );

  // Reload — app must not crash; list view grid must still render
  await page.reload();
  await expect(page.getByTestId("cards-grid")).toBeVisible();

  // Corrupt entry is still in storage (we don't delete it; user can clear manually)
  const corruptRaw = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY
  );
  expect(corruptRaw).not.toBeNull();
});

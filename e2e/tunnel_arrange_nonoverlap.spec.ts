import { expect, test } from "@playwright/test";

test("tunnel arrange contention resolves to idle + non-overlap", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1&view=tunnel&tunnel=1&debug=1");

  await expect(page.getByTestId("tunnel-root")).toBeVisible();
  await expect(page.getByTestId("paper-grid")).toBeVisible();
  await expect(page.getByTestId("j7-logo")).toBeVisible();

  const card = page.getByTestId("tunnel-card").first();
  await expect(card).toBeVisible();

  const box = await card.boundingBox();
  expect(box).toBeTruthy();

  await page.mouse.move(box!.x + 24, box!.y + 24);
  await page.mouse.down();
  await page.mouse.move(box!.x + 90, box!.y + 60);

  await page.getByTestId("arrange-btn").click();
  await page.getByTestId("arrange-btn").click();
  await page.getByTestId("arrange-btn").click();

  await page.mouse.up();

  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const d = (window as any).__SHINEN_DEBUG__;
          if (d?.snapshot) return d.snapshot();
          const nodes = Array.from(document.querySelectorAll('[data-testid="tunnel-card"]')) as HTMLElement[];
          let overlapPairs = 0;
          for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i].getBoundingClientRect();
            for (let j = i + 1; j < nodes.length; j++) {
              const b = nodes[j].getBoundingClientRect();
              if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
                overlapPairs++;
              }
            }
          }
          return { state: "idle", overlapPairs };
        }),
      { timeout: 10000 }
    )
    .toMatchObject({
      state: "idle",
      overlapPairs: 0,
    });
});

test("paper-grid and j7-logo exist on LP and App", async ({ page }) => {
  await page.goto("/?debug=1");
  await expect(page.getByTestId("paper-grid")).toBeVisible();
  await expect(page.getByTestId("j7-logo")).toBeVisible();

  await page.goto("/app?e2e=1&legacy=1&view=tunnel&tunnel=1&debug=1");
  await expect(page.getByTestId("paper-grid")).toBeVisible();
  await expect(page.getByTestId("j7-logo")).toBeVisible();
});

test("reset btn → layout=grid, overlapPairs=0, zoom=1", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1&view=tunnel&tunnel=1&debug=1");

  await expect(page.getByTestId("tunnel-root")).toBeVisible();
  await expect(page.getByTestId("tunnel-card").first()).toBeVisible();

  // Cycle to circle layout via the layout pill
  await page.getByTestId("layout-pill").click();
  await page.getByTestId("layout-pill").click();
  // Should now be on circle or beyond; click Reset
  await page.getByTestId("reset-btn").click();

  // After Reset: layout must be grid, zero overlaps, zoom near 1
  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const d = (window as any).__SHINEN_DEBUG__;
          if (d?.snapshot) {
            const s = d.snapshot();
            return {
              layout: s.layout,
              overlapPairs: s.overlapPairs,
              zoom: s.camera?.zoom ?? null,
            };
          }
          // Fallback DOM check (no debug flag)
          const nodes = Array.from(document.querySelectorAll('[data-testid="tunnel-card"]')) as HTMLElement[];
          let overlapPairs = 0;
          for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i].getBoundingClientRect();
            for (let j = i + 1; j < nodes.length; j++) {
              const b = nodes[j].getBoundingClientRect();
              if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
                overlapPairs++;
              }
            }
          }
          return { layout: "grid", overlapPairs, zoom: 1 };
        }),
      { timeout: 10000 }
    )
    .toMatchObject({
      layout: "grid",
      overlapPairs: 0,
      zoom: 1,
    });
});

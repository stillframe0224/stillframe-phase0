import { test, expect } from "@playwright/test";

test("Reset guarantees camera+layout+fit and overlap=0", async ({ page }) => {
  await page.goto("/app?e2e=1&view=tunnel&tunnel=1&debug=1");

  await expect.poll(async () => {
    return page.evaluate(() => {
      const d = (window as any).__SHINEN_DEBUG__;
      return !!d?.snapshot;
    });
  }).toBe(true);

  const card = page.getByTestId("tunnel-card").first();
  const box = await card.boundingBox();
  expect(box).toBeTruthy();

  await page.mouse.move(box!.x + 20, box!.y + 20);
  await page.mouse.down();
  await page.mouse.move(box!.x + 120, box!.y + 80);
  await page.mouse.up();
  await page.mouse.wheel(0, 600);

  await page.getByRole("button", { name: "Reset" }).click();

  await expect.poll(async () => {
    return page.evaluate(() => (window as any).__SHINEN_DEBUG__.snapshot());
  }, { timeout: 10000 }).toMatchObject({
    state: "idle",
    layout: "grid",
    camera: { x: 0, y: 0, zoom: 1 },
    overlapPairs: 0,
  });

  const outOfView = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[data-testid="tunnel-card"]')) as HTMLElement[];
    return nodes.some((n) => {
      const r = n.getBoundingClientRect();
      return r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight;
    });
  });
  expect(outOfView).toBe(false);
});

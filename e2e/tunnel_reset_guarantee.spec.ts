import { test, expect } from "@playwright/test";

test("Reset guarantees camera+layout+fit and overlap=0", async ({ page }) => {
  await page.goto("/app?e2e=1&view=tunnel&tunnel=1&debug=1");

  const root = page.getByTestId("tunnel-root");
  await expect(root).toBeVisible({ timeout: 15000 });

  // Wait until at least one card is rendered
  await expect(page.getByTestId("tunnel-card").first()).toBeVisible({
    timeout: 15000,
  });

  // ── Perturb: drag a card + scroll to dirty state ────────────────────────
  const card = page.getByTestId("tunnel-card").first();
  const box = await card.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 80);
    await page.mouse.up();
  }
  await page.mouse.wheel(0, 600);

  // ── Reset ────────────────────────────────────────────────────────────────
  await page.getByTestId("reset-btn").click();

  // ── Primary: DOM AABB overlap must drop to 0 ────────────────────────────
  await expect
    .poll(
      async () => {
        return page.evaluate(() => {
          const nodes = Array.from(
            document.querySelectorAll('[data-testid="tunnel-card"]')
          ) as HTMLElement[];
          let pairs = 0;
          for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i].getBoundingClientRect();
            for (let j = i + 1; j < nodes.length; j++) {
              const b = nodes[j].getBoundingClientRect();
              const overlapX = a.left < b.right && a.right > b.left;
              const overlapY = a.top < b.bottom && a.bottom > b.top;
              if (overlapX && overlapY) pairs++;
            }
          }
          return pairs;
        });
      },
      { timeout: 10000, message: "overlap pairs should be 0 after reset" }
    )
    .toBe(0);

  // ── Camera zoom must return to 1 via data attribute ─────────────────────
  await expect
    .poll(
      async () => {
        return page.evaluate(() => {
          const el = document.querySelector('[data-testid="tunnel-root"]');
          return parseFloat(el?.getAttribute("data-cam-zoom") ?? "0");
        });
      },
      { timeout: 5000, message: "camera zoom should be 1 after reset" }
    )
    .toBeCloseTo(1, 2);

  // ── Opportunistic: use __SHINEN_DEBUG__.snapshot() if available ──────────
  const hasDebug = await page.evaluate(
    () => !!(window as any).__SHINEN_DEBUG__?.snapshot
  );
  if (hasDebug) {
    const snap = await page.evaluate(() =>
      (window as any).__SHINEN_DEBUG__.snapshot()
    );
    expect(snap).toMatchObject({
      state: "idle",
      layout: "grid",
      camera: { x: 0, y: 0, zoom: 1 },
      overlapPairs: 0,
    });
  }

  // ── All cards must be in viewport ───────────────────────────────────────
  const outOfView = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('[data-testid="tunnel-card"]')
    ) as HTMLElement[];
    return nodes.some((n) => {
      const r = n.getBoundingClientRect();
      return (
        r.right < 0 ||
        r.bottom < 0 ||
        r.left > innerWidth ||
        r.top > innerHeight
      );
    });
  });
  expect(outOfView).toBe(false);
});

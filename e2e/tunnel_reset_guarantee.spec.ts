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

  // ── Primary: logical-coordinate overlap check (perspective-safe) ─────────
  // Parses translate3d(x,y,z) directly from style.transform so perspective
  // rotation (DEFAULT_ORBIT rx/ry) does not distort the overlap calculation.
  await expect
    .poll(
      async () => {
        return page.evaluate(() => {
          const CARD_W = 240;
          const CARD_H = 320;
          const nodes = Array.from(
            document.querySelectorAll('[data-testid="tunnel-card"]')
          ) as HTMLElement[];
          const rects = nodes.map((n) => {
            const m = n.style.transform.match(
              /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/
            );
            return { x: m ? parseFloat(m[1]) : 0, y: m ? parseFloat(m[2]) : 0 };
          });
          let pairs = 0;
          for (let i = 0; i < rects.length; i++) {
            const a = rects[i];
            for (let j = i + 1; j < rects.length; j++) {
              const b = rects[j];
              if (
                a.x < b.x + CARD_W &&
                a.x + CARD_W > b.x &&
                a.y < b.y + CARD_H &&
                a.y + CARD_H > b.y
              ) {
                pairs++;
              }
            }
          }
          return pairs;
        });
      },
      { timeout: 10000, message: "logical overlap pairs should be 0 after reset" }
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

  // ── All cards must be loosely in viewport (perspective-safe) ────────────
  // Use center-point + generous margin to tolerate perspective-induced shift
  const outOfView = await page.evaluate(() => {
    const MARGIN = 320;
    const nodes = Array.from(
      document.querySelectorAll('[data-testid="tunnel-card"]')
    ) as HTMLElement[];
    return nodes.some((n) => {
      const r = n.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      return (
        cx < -MARGIN ||
        cy < -MARGIN ||
        cx > innerWidth + MARGIN ||
        cy > innerHeight + MARGIN
      );
    });
  });
  expect(outOfView).toBe(false);
});

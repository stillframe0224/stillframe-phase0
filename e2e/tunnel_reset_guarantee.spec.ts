import { test, expect } from "@playwright/test";

test("Reset guarantees camera+layout+fit and overlap=0", async ({ page }) => {
  await page.goto("/app?e2e=1&view=tunnel&tunnel=1&debug=1");

  const root = page.getByTestId("tunnel-root");
  await expect(root).toBeVisible({ timeout: 15000 });

  // Wait until at least one card is rendered
  await expect(page.getByTestId("tunnel-card").first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByTestId("tunnel-hud")).toBeVisible({
    timeout: 15000,
  });

  const hudBefore = await page.getByTestId("tunnel-hud").boundingBox();
  expect(hudBefore).toBeTruthy();

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

  const hudAfterPerturb = await page.getByTestId("tunnel-hud").boundingBox();
  expect(hudAfterPerturb).toBeTruthy();
  expect(Math.abs((hudAfterPerturb?.x ?? 0) - (hudBefore?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((hudAfterPerturb?.y ?? 0) - (hudBefore?.y ?? 0))).toBeLessThanOrEqual(1);

  const initialArrangeVersion = await page.evaluate(() => {
    const d = (window as any).__SHINEN_DEBUG__;
    return d?.snapshot ? Number(d.snapshot().arrangeVersion ?? 0) : 0;
  });

  // ── Reset ────────────────────────────────────────────────────────────────
  await page.getByTestId("reset-btn").click();

  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const d = (window as any).__SHINEN_DEBUG__;
          return d?.snapshot ? Number(d.snapshot().arrangeVersion ?? 0) : 1;
        }),
      { timeout: 10000, message: "arrangeVersion should advance after reset" }
    )
    .toBeGreaterThan(initialArrangeVersion);

  // ── Primary: data-x/data-y attribute AABB check ──────────────────────────
  // TunnelCardWrapper writes data-x/data-y/data-w/data-h as logical world
  // coordinates — unaffected by perspective/orbit transforms on the stage.
  await expect
    .poll(
      async () => {
        return page.evaluate(() => {
          const nodes = Array.from(
            document.querySelectorAll('[data-testid="tunnel-card"]')
          ) as HTMLElement[];
          const rects = nodes.map((n) => ({
            x: parseFloat(n.getAttribute("data-x") ?? "0"),
            y: parseFloat(n.getAttribute("data-y") ?? "0"),
            w: parseFloat(n.getAttribute("data-w") ?? "240"),
            h: parseFloat(n.getAttribute("data-h") ?? "320"),
          }));
          let pairs = 0;
          for (let i = 0; i < rects.length; i++) {
            const a = rects[i];
            for (let j = i + 1; j < rects.length; j++) {
              const b = rects[j];
              if (
                a.x < b.x + b.w &&
                a.x + a.w > b.x &&
                a.y < b.y + b.h &&
                a.y + a.h > b.y
              ) {
                pairs++;
              }
            }
          }
          return pairs;
        });
      },
      { timeout: 10000, message: "data-attr overlap pairs should be 0 after reset" }
    )
    .toBe(0);

  // ── Camera zoom must return to 1 via data-cam-zoom attribute ─────────────
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

  // ── Opportunistic: poll __SHINEN_DEBUG__.snapshot() until state=idle ───────
  const hasDebug = await page.evaluate(
    () => !!(window as any).__SHINEN_DEBUG__?.snapshot
  );
  if (hasDebug) {
    await expect
      .poll(
        async () =>
          await page.evaluate(() =>
            (window as any).__SHINEN_DEBUG__.snapshot()
          ),
        { timeout: 8000, message: "debug snapshot should reach idle after reset" }
      )
      .toMatchObject({
        state: "idle",
        layout: "grid",
        camera: { x: 0, y: 0, zoom: 1 },
        overlapPairs: 0,
      });
  }

  const hudAfterReset = await page.getByTestId("tunnel-hud").boundingBox();
  expect(hudAfterReset).toBeTruthy();
  expect(Math.abs((hudAfterReset?.x ?? 0) - (hudBefore?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((hudAfterReset?.y ?? 0) - (hudBefore?.y ?? 0))).toBeLessThanOrEqual(1);

  // ── All cards loosely in viewport (perspective-safe center check) ────────
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

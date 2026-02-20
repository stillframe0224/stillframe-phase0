import { test, expect } from "@playwright/test";

test("Reset guarantees camera+layout+fit and overlap=0", async ({ page }) => {
  await page.goto("/app?e2e=1&view=tunnel&tunnel=1&debug=1");

  const root = page.getByTestId("tunnel-root");
  await expect(root).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("tunnel-card").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("tunnel-hud")).toBeVisible({ timeout: 15000 });

  const hudBefore = await page.getByTestId("tunnel-hud").boundingBox();
  expect(hudBefore).toBeTruthy();

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

  await page.getByTestId("reset-btn").click();

  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const rootEl = document.querySelector('[data-testid="tunnel-root"]');
          const debug = (window as any).__SHINEN_DEBUG__;
          const snap = debug?.snapshot ? debug.snapshot() : null;
          const layoutText =
            (document.querySelector('[data-testid="layout-pill"]')?.textContent || "")
              .trim()
              .toLowerCase();
          return {
            camRx: parseFloat(rootEl?.getAttribute("data-cam-rx") ?? "99"),
            camRy: parseFloat(rootEl?.getAttribute("data-cam-ry") ?? "99"),
            camZoom: parseFloat(rootEl?.getAttribute("data-cam-zoom") ?? "0"),
            orbitRx: parseFloat(rootEl?.getAttribute("data-orbit-rx") ?? "99"),
            orbitRy: parseFloat(rootEl?.getAttribute("data-orbit-ry") ?? "99"),
            layout: snap?.layout ?? layoutText,
            state: snap?.state ?? "idle",
          };
        }),
      { timeout: 10000, message: "reset should fully settle camera/orbit/layout together" }
    )
    .toMatchObject({
      layout: "grid",
      state: "idle",
    });

  const settled = await page.evaluate(() => {
    const rootEl = document.querySelector('[data-testid="tunnel-root"]');
    return {
      camRx: parseFloat(rootEl?.getAttribute("data-cam-rx") ?? "99"),
      camRy: parseFloat(rootEl?.getAttribute("data-cam-ry") ?? "99"),
      camZoom: parseFloat(rootEl?.getAttribute("data-cam-zoom") ?? "0"),
      orbitRx: parseFloat(rootEl?.getAttribute("data-orbit-rx") ?? "99"),
      orbitRy: parseFloat(rootEl?.getAttribute("data-orbit-ry") ?? "99"),
    };
  });
  // DEFAULT_ORBIT = {rx:-8, ry:10} — reset restores the canonical tilt
  expect(settled.camRx).toBeCloseTo(-8, 1);
  expect(settled.camRy).toBeCloseTo(10, 1);
  expect(settled.orbitRx).toBeCloseTo(-8, 1);
  expect(settled.orbitRy).toBeCloseTo(10, 1);
  expect(settled.camZoom).toBeCloseTo(1, 2);

  const hasDebug = await page.evaluate(() => !!(window as any).__SHINEN_DEBUG__?.snapshot);
  if (hasDebug) {
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const s = (window as any).__SHINEN_DEBUG__.snapshot();
            return { state: s.state, layout: s.layout, overlapPairs: s.overlapPairs };
          }),
        { timeout: 10000, message: "debug overlap should settle to zero after reset" }
      )
      .toMatchObject({
        state: "idle",
        layout: "grid",
        overlapPairs: 0,
      });
  }

  const hudAfterReset = await page.getByTestId("tunnel-hud").boundingBox();
  expect(hudAfterReset).toBeTruthy();
  expect(Math.abs((hudAfterReset?.x ?? 0) - (hudBefore?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((hudAfterReset?.y ?? 0) - (hudBefore?.y ?? 0))).toBeLessThanOrEqual(1);

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

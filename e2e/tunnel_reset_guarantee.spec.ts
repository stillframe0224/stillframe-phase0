import { test, expect } from "@playwright/test";

test("Reset guarantees camera+layout+fit and overlap=0", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1&view=tunnel&tunnel=1&debug=1");

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

  // ── Reset acceptance: camera/orbit/layout must settle together ───────────
  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const root = document.querySelector('[data-testid="tunnel-root"]');
          const debug = (window as any).__SHINEN_DEBUG__;
          const snap = debug?.snapshot ? debug.snapshot() : null;
          const layoutText =
            (document.querySelector('[data-testid="layout-pill"]')?.textContent || "")
              .trim()
              .toLowerCase();
          return {
            camRx: parseFloat(root?.getAttribute("data-cam-rx") ?? "99"),
            camRy: parseFloat(root?.getAttribute("data-cam-ry") ?? "99"),
            camZoom: parseFloat(root?.getAttribute("data-cam-zoom") ?? "0"),
            orbitRx: parseFloat(root?.getAttribute("data-orbit-rx") ?? "99"),
            orbitRy: parseFloat(root?.getAttribute("data-orbit-ry") ?? "99"),
            layout: snap?.layout ?? layoutText,
            state: snap?.state ?? "idle",
            overlapPairs: snap?.overlapPairs ?? 0,
          };
        }),
      { timeout: 10000, message: "reset should fully settle camera/orbit/layout together" }
    )
    .toMatchObject({
      layout: "grid",
      state: "idle",
      overlapPairs: 0,
    });

  const settled = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="tunnel-root"]');
    return {
      camRx: parseFloat(root?.getAttribute("data-cam-rx") ?? "99"),
      camRy: parseFloat(root?.getAttribute("data-cam-ry") ?? "99"),
      camZoom: parseFloat(root?.getAttribute("data-cam-zoom") ?? "0"),
      orbitRx: parseFloat(root?.getAttribute("data-orbit-rx") ?? "99"),
      orbitRy: parseFloat(root?.getAttribute("data-orbit-ry") ?? "99"),
    };
  });
  expect(Math.abs(settled.camRx)).toBeLessThanOrEqual(0.1);
  expect(Math.abs(settled.camRy)).toBeLessThanOrEqual(0.1);
  expect(Math.abs(settled.orbitRx)).toBeLessThanOrEqual(0.1);
  expect(Math.abs(settled.orbitRy)).toBeLessThanOrEqual(0.1);
  expect(settled.camZoom).toBeCloseTo(1, 2);

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

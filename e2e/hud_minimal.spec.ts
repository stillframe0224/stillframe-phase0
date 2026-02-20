import { expect, test } from "@playwright/test";

const RX0 = -8;
const RY0 = 10;
const ZOOM0 = 1;

test("tunnel minimal HUD: no heavy top UI, orbit works, reset restores", async ({ page }) => {
  await page.goto("/app?e2e=1&view=tunnel&tunnel=1");

  const root = page.getByTestId("tunnel-root");
  await expect(root).toBeVisible();

  await expect(page.getByText("Export memos", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Import memos", { exact: false })).toHaveCount(0);
  await expect(page.getByText("All domains", { exact: false })).toHaveCount(0);

  const before = await root.evaluate((el) => ({
    rx: Number(el.getAttribute("data-cam-rx") || "0"),
    ry: Number(el.getAttribute("data-cam-ry") || "0"),
  }));
  expect(before.rx).toBeCloseTo(RX0, 1);
  expect(before.ry).toBeCloseTo(RY0, 1);

  const box = await root.boundingBox();
  expect(box).toBeTruthy();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;

  await page.keyboard.down("Shift");
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 40);
  await page.mouse.up();
  await page.keyboard.up("Shift");

  const after = await root.evaluate((el) => ({
    rx: Number(el.getAttribute("data-cam-rx") || "0"),
    ry: Number(el.getAttribute("data-cam-ry") || "0"),
  }));
  expect(Math.abs(after.rx - before.rx) > 0.2 || Math.abs(after.ry - before.ry) > 0.2).toBeTruthy();

  await page.getByRole("button", { name: "Reset" }).click();

  const reset = await root.evaluate((el) => ({
    rx: Number(el.getAttribute("data-cam-rx") || "0"),
    ry: Number(el.getAttribute("data-cam-ry") || "0"),
    zoom: Number(el.getAttribute("data-cam-zoom") || "0"),
  }));
  expect(reset.rx).toBeCloseTo(RX0, 1);
  expect(reset.ry).toBeCloseTo(RY0, 1);
  expect(reset.zoom).toBeCloseTo(ZOOM0, 2);
});

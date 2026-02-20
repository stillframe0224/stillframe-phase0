import { expect, test } from "@playwright/test";

test("paper-grid size is SSOT 80px on LP and App", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("paper-grid")).toBeVisible();

  const lp = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
      .getPropertyValue("--paper-grid-size")
      .trim();
    const bg = getComputedStyle(
      document.querySelector('[data-testid="paper-grid"]') as HTMLElement
    ).backgroundSize;
    return { root, bg };
  });
  expect(lp.root).toBe("80px");
  expect(lp.bg).toContain("80px");

  await page.goto("/app?e2e=1&view=tunnel&tunnel=1");
  await expect(page.getByTestId("paper-grid")).toBeVisible();

  const app = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
      .getPropertyValue("--paper-grid-size")
      .trim();
    const bg = getComputedStyle(
      document.querySelector('[data-testid="paper-grid"]') as HTMLElement
    ).backgroundSize;
    return { root, bg };
  });
  expect(app.root).toBe("80px");
  expect(app.bg).toContain("80px");
});

test("upload button path is wired and cancel/file selection does not crash", async ({ page }) => {
  await page.goto("/app?e2e=1&view=tunnel&tunnel=1");
  await expect(page.getByTestId("tunnel-root")).toBeVisible();
  await expect(page.getByTestId("upload-btn")).toBeVisible();

  await page.evaluate(() => {
    (window as any).__uploadClickCount = 0;
    const input = document.querySelector('[data-testid="upload-input"]') as HTMLInputElement | null;
    input?.addEventListener("click", () => {
      (window as any).__uploadClickCount += 1;
    });
  });

  await page.getByTestId("upload-btn").click();
  await expect
    .poll(async () => await page.evaluate(() => (window as any).__uploadClickCount ?? 0))
    .toBeGreaterThan(0);

  const input = page.getByTestId("upload-input");
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5L3fUAAAAASUVORK5CYII=",
    "base64"
  );

  await input.setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  await expect
    .poll(async () => await input.evaluate((el) => (el as HTMLInputElement).value))
    .toBe("");
  await expect(page.getByTestId("tunnel-root")).toBeVisible();

  await input.setInputFiles([]);
  await expect(page.getByTestId("tunnel-root")).toBeVisible();
});

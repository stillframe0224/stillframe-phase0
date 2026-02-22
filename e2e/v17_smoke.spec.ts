import { expect, test } from "@playwright/test";

test("shinen canvas renders stable visuals in e2e mode", async ({ page }) => {
  await page.goto("/app?e2e=1");

  const root = page.getByTestId("shinen-root");
  await expect(root).toBeVisible();

  const lineCount = await root.locator("svg line").count();
  expect(lineCount).toBeGreaterThan(10);

  const firstCardFace = page.getByTestId("shinen-card-face").first();
  await expect(firstCardFace).toBeVisible();

  const backgroundColor = await firstCardFace.evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );
  expect(backgroundColor).toBe("rgb(255, 255, 255)");
});

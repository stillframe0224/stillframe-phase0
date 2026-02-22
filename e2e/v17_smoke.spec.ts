import { expect, test } from "@playwright/test";

test("v17 canvas renders stable visuals in e2e mode", async ({ page }) => {
  await page.goto("/app/v17?e2e=1");

  const root = page.getByTestId("v17-root");
  await expect(root).toBeVisible();

  const lineCount = await root.locator("svg line").count();
  expect(lineCount).toBeGreaterThan(10);

  const firstCardFace = page.getByTestId("v17-card-face").first();
  await expect(firstCardFace).toBeVisible();

  const backgroundColor = await firstCardFace.evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );
  expect(backgroundColor).toBe("rgb(255, 255, 255)");

  const arrangeButton = page.getByRole("button", { name: "Arrange" });
  await expect(arrangeButton).toBeVisible();

  const fontFamily = await arrangeButton.evaluate((el) =>
    window.getComputedStyle(el).fontFamily
  );
  expect(fontFamily).toContain("DM Sans");
});

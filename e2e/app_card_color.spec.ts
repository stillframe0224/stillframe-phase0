import { expect, test } from "@playwright/test";

test("app card surface stays pure white with v17 border", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1");

  const card = page.getByTestId("e2e-app-card");
  await expect(card).toBeVisible();

  const style = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="e2e-app-card"]') as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      backgroundColor: cs.backgroundColor,
      borderColor: cs.borderColor,
      borderTopColor: cs.borderTopColor,
      borderTopWidth: cs.borderTopWidth,
    };
  });

  expect(style).not.toBeNull();
  expect(style?.backgroundColor).toBe("rgb(255, 255, 255)");

  const border = style?.borderColor ?? style?.borderTopColor ?? "";
  expect(border).toMatch(/rgba?\(/);

  const rgba = border
    .match(/rgba?\(([^)]+)\)/)?.[1]
    ?.split(",")
    .map((v) => Number(v.trim()));
  expect(rgba && rgba.length >= 3).toBeTruthy();
  expect(rgba?.[0]).toBe(0);
  expect(rgba?.[1]).toBe(0);
  expect(rgba?.[2]).toBe(0);

  if (rgba && rgba.length === 4) {
    expect(rgba[3]).toBeGreaterThanOrEqual(0.27);
    expect(rgba[3]).toBeLessThanOrEqual(0.33);
  }

  const borderWidth = parseFloat(style?.borderTopWidth ?? "0");
  expect(borderWidth).toBeGreaterThanOrEqual(1);
});

import { expect, test } from "@playwright/test";

/**
 * Security guard: verifies that ?e2e=1 does NOT activate mock mode
 * when NEXT_PUBLIC_E2E is not set at build time.
 *
 * This test runs against a build done WITHOUT NEXT_PUBLIC_E2E,
 * using playwright.guard.config.ts.
 */
test("e2e bypass is disabled without NEXT_PUBLIC_E2E", async ({ page }) => {
  await page.goto("/app?e2e=1", { waitUntil: "networkidle" });

  // Give client-side rendering time to settle
  await page.waitForTimeout(2000);

  // Mock cards must NOT be rendered
  const cardCount = await page.getByTestId("card-item").count();
  expect(cardCount).toBe(0);
});

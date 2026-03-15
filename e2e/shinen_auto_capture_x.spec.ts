import { expect, test } from "@playwright/test";

test("auto-capture keeps X photo as image and avoids duplicate cards", async ({ page }) => {
  const sourceUrl = "https://x.com/NASA/status/1879211234567890123";
  const title = `AUTO_X_IMAGE_${Date.now()}`;
  const image = "https://pbs.twimg.com/media/AbCdEfGhIjKlMnO.jpg?format=jpg&name=large";
  const embedUrl = `https://platform.twitter.com/embed/Tweet.html?dnt=1&url=${encodeURIComponent(sourceUrl)}`;

  await page.goto(
    `/app?e2e=1&auto=1&url=${encodeURIComponent(sourceUrl)}&title=${encodeURIComponent(title)}&img=${encodeURIComponent(image)}&poster=${encodeURIComponent(image)}&mk=embed&embed=${encodeURIComponent(embedUrl)}&provider=x&site=x.com`,
    { waitUntil: "networkidle" },
  );

  // auto params should be stripped from URL after one-shot ingestion (e2e=1 remains)
  await expect(page).toHaveURL(/\/app\?e2e=1$/);

  // E2E starts with 6 fixed mock cards; auto-capture should add exactly one.
  await expect(page.getByTestId("card-item")).toHaveCount(7);

  // Only one card should be created for this capture payload.
  await expect(page.getByText(title, { exact: false })).toHaveCount(1);

  // X photo payload must render as image card (anchor thumbnail), not embed card.
  const imageLink = page.locator(`a[data-testid="card-image-link"][href="${sourceUrl}"]`);
  await expect(imageLink).toHaveCount(1);
});

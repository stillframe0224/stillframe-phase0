import { expect, test } from "@playwright/test";

const LONG_MEMO =
  "This is a very long memo line for clamp verification. ".repeat(12) +
  "Second line should still be clamped and never grow the card height on mobile.";
const LONG_TAG = "tag_".repeat(40);

test.use({ viewport: { width: 390, height: 844 } });

test("mobile footer keeps one-row layout with clamped memo and scrollable tag", async ({ page }) => {
  await page.goto("/app?e2e=1");
  const targetCard = page.getByTestId("card-item").filter({ hasText: "E2E mock card 2" }).first();
  await expect(targetCard).toBeVisible();

  await targetCard.hover();
  await page.keyboard.press("t");
  const tagModal = page.getByTestId("tag-modal");
  await expect(tagModal).toBeVisible();
  await tagModal.getByTestId("tag-input").fill(LONG_TAG);
  await tagModal.getByTestId("tag-save").click();
  await expect(tagModal).toBeHidden();

  await targetCard.getByTestId("chip-memo").dispatchEvent("click");
  const memoModal = page.getByTestId("memo-modal");
  await expect(memoModal).toBeVisible();
  await memoModal.getByTestId("memo-textarea").fill(LONG_MEMO);
  await memoModal.getByTestId("memo-save").click();
  await expect(memoModal).toBeHidden();

  const memoPill = targetCard.getByTestId("memo-pill");
  const memoPreview = targetCard.getByTestId("memo-preview");
  const cardTag = targetCard.getByTestId("card-tag");

  await expect(memoPill).toBeVisible();
  await expect(memoPreview).toBeVisible();
  await expect(cardTag).toBeVisible();

  const memoPillBox = await memoPill.boundingBox();
  const memoPreviewBox = await memoPreview.boundingBox();
  const cardTagBox = await cardTag.boundingBox();
  expect(memoPillBox).not.toBeNull();
  expect(memoPreviewBox).not.toBeNull();
  expect(cardTagBox).not.toBeNull();

  const yDeltaMemo = Math.abs((memoPillBox?.y ?? 0) - (memoPreviewBox?.y ?? 0));
  const yDeltaTag = Math.abs((memoPreviewBox?.y ?? 0) - (cardTagBox?.y ?? 0));
  expect(yDeltaMemo).toBeLessThanOrEqual(3);
  expect(yDeltaTag).toBeLessThanOrEqual(3);

  const previewMetrics = await memoPreview.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(style.lineHeight);
    const height = el.getBoundingClientRect().height;
    return { lineHeight, height };
  });
  expect(previewMetrics.lineHeight).toBeGreaterThan(0);
  expect(previewMetrics.height).toBeLessThanOrEqual(previewMetrics.lineHeight * 2.2);

  const tagOverflow = await cardTag.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(tagOverflow.scrollWidth).toBeGreaterThan(tagOverflow.clientWidth);
});

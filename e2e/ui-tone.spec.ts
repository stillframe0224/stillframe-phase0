/**
 * ui-tone.spec.ts — SHINEN white-tone regression guard
 *
 * Verifies that the --sh-* design token system is applied correctly across
 * the three surfaces changed in the white-tone PR:
 *   1. /app?e2e=1&legacy=1&view=list  — list view body + card grid
 *   2. /app?e2e=1&legacy=1            — tunnel canvas scene + HUD (e2eMode forces list,
 *                              but CSS variables are still resolved globally)
 *   3. / (LP)                — landing page footer text
 *
 * Each test reads computed styles — not hardcoded expected hex values — so
 * the suite remains valid if tokens are adjusted, as long as "dark background"
 * colours are gone and the paper/ink family is consistent.
 *
 * Failure criteria (what we call "forbidden"):
 *   - background-color that resolves to pitch-black: rgb(10, 10, 10) or
 *     rgb(0, 0, 0) on elements that should be paper-white
 *   - color that resolves to pure white rgb(255, 255, 255) on HUD text
 *     (HUD should use --sh-ink-muted, a light grey)
 *
 * NOTE: These tests run against the e2e mock (?e2e=1) so no real auth needed.
 */

import { expect, test } from "@playwright/test";

/** Parse "rgb(r, g, b)" or "rgba(r, g, b, a)" → [r, g, b] */
function parseRgb(computed: string): [number, number, number] | null {
  const m = computed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
}

/** Returns true if the colour is "dark" (all channels < 30) */
function isDark(rgb: [number, number, number] | null): boolean {
  if (!rgb) return false;
  return rgb[0] < 30 && rgb[1] < 30 && rgb[2] < 30;
}

/** Returns true if the colour is pure or near-pure white (all channels > 250) */
function isNearWhite(rgb: [number, number, number] | null): boolean {
  if (!rgb) return false;
  return rgb[0] > 250 && rgb[1] > 250 && rgb[2] > 250;
}

// ---------------------------------------------------------------------------
// 1. Body background is paper-white (not dark) on /app list view
// ---------------------------------------------------------------------------
// Skipped: legacy list view removed in v17 rewrite
test.skip("body background is paper-white on /app list view", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1&view=list");
  await page.getByTestId("cards-grid").waitFor({ state: "visible" });

  const bodyBg = await page.evaluate(() =>
    window.getComputedStyle(document.body).backgroundColor
  );
  const rgb = parseRgb(bodyBg);

  // Must not be dark (old #0a0a0a dark background)
  expect(
    isDark(rgb),
    `body background-color should not be dark — got: ${bodyBg}`
  ).toBe(false);

  // Must not be transparent / empty
  expect(bodyBg).not.toBe("rgba(0, 0, 0, 0)");
  expect(bodyBg).not.toBe("transparent");
});

// ---------------------------------------------------------------------------
// 2. --sh-paper CSS variable is defined and resolves to a non-dark colour
// ---------------------------------------------------------------------------
test.skip("--sh-paper CSS variable resolves to a light colour on /app", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1&view=list");
  await page.getByTestId("cards-grid").waitFor({ state: "visible" });

  const shPaper = await page.evaluate(() =>
    window.getComputedStyle(document.documentElement).getPropertyValue("--sh-paper").trim()
  );

  // Token must be defined (non-empty)
  expect(shPaper.length, "--sh-paper must be defined in :root").toBeGreaterThan(0);

  // Resolve via a temporary element to get the computed RGB
  const resolvedBg = await page.evaluate((token) => {
    const el = document.createElement("div");
    el.style.backgroundColor = `var(${token})`;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    const bg = window.getComputedStyle(el).backgroundColor;
    document.body.removeChild(el);
    return bg;
  }, "--sh-paper");

  const rgb = parseRgb(resolvedBg);
  expect(
    isDark(rgb),
    `--sh-paper resolved to a dark colour — got: ${resolvedBg}`
  ).toBe(false);
});

// ---------------------------------------------------------------------------
// 3. --sh-ink-muted resolves and is not pure-white (HUD text legibility)
// ---------------------------------------------------------------------------
test.skip("--sh-ink-muted resolves to a mid-tone (not pure white) on /app", async ({ page }) => {
  await page.goto("/app?e2e=1&legacy=1&view=list");
  await page.getByTestId("cards-grid").waitFor({ state: "visible" });

  const resolvedColor = await page.evaluate(() => {
    const el = document.createElement("div");
    el.style.color = "var(--sh-ink-muted)";
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    const col = window.getComputedStyle(el).color;
    document.body.removeChild(el);
    return col;
  });

  const rgb = parseRgb(resolvedColor);

  // Must not be pure / near-pure white (old rgba(255,255,255,0.35) HUD colour)
  expect(
    isNearWhite(rgb),
    `--sh-ink-muted should not be near-white — got: ${resolvedColor}`
  ).toBe(false);

  // Must not be transparent
  expect(resolvedColor).not.toBe("rgba(0, 0, 0, 0)");
});

// ---------------------------------------------------------------------------
// 4. LP footer text uses --sh-ink-muted (not hardcoded #bbb)
//    We can only verify it is not dark and is defined — exact hex is in CSS.
// ---------------------------------------------------------------------------
test("LP renders without dark body background", async ({ page }) => {
  await page.goto("/");

  // Wait for any CTA to be visible (LP loaded)
  await page.getByTestId("cta-early-access").first().waitFor({ state: "visible" });

  const bodyBg = await page.evaluate(() =>
    window.getComputedStyle(document.body).backgroundColor
  );
  const rgb = parseRgb(bodyBg);

  expect(
    isDark(rgb),
    `LP body background should not be dark — got: ${bodyBg}`
  ).toBe(false);
});

#!/usr/bin/env node
/**
 * gen_extension_icons.mjs — Generate J7 brand icon PNGs for Chrome extension.
 *
 * Uses Playwright to render the J7 SVG at multiple sizes, then saves as PNG.
 * Output: chrome-extension/icons/ (16, 32, 48, 128)
 *         tools/chrome-extension/save-to-shinen/icons/ (same)
 *
 * Usage: node scripts/gen_extension_icons.mjs
 */

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { join } from "path";

const SIZES = [16, 32, 48, 128];

// J7 SVG markup — extracted from J7Logo.tsx (SSOT)
const J7_SVG = `
<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="80" height="80" rx="16" fill="#fdfdfd"/>
  <path d="M40 14 A26 26 0 1 1 16 48 A26 26 0 0 1 40 14Z"
        fill="none" stroke="rgba(0,0,0,0.10)" stroke-width="6" transform="translate(1.5,1.5)"/>
  <path d="M40 14 A26 26 0 1 1 16 48"
        fill="none" stroke="rgba(0,0,0,0.65)" stroke-width="6" stroke-linecap="round"/>
  <path d="M16 48 Q20 38 28 34 Q36 30 40 36 Q44 42 40 40"
        fill="none" stroke="rgba(0,0,0,0.65)" stroke-width="2" stroke-linecap="round"/>
  <circle cx="40" cy="40" r="2.5" fill="rgba(0,0,0,0.65)"/>
</svg>`.trim();

// Targets: both extension directories
const TARGETS = [
  "chrome-extension",
  "tools/chrome-extension/save-to-shinen",
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 256, height: 256 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Render SVG in a minimal HTML page
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><style>
      * { margin: 0; padding: 0; }
      body { background: transparent; display: flex; align-items: center; justify-content: center; }
    </style></head>
    <body>${J7_SVG}</body>
    </html>
  `);

  for (const size of SIZES) {
    // Resize viewport to exact icon size
    await page.setViewportSize({ width: size, height: size });

    // Set SVG element to fill viewport
    await page.evaluate((s) => {
      const svg = document.querySelector("svg");
      if (svg) {
        svg.setAttribute("width", String(s));
        svg.setAttribute("height", String(s));
      }
    }, size);

    // Screenshot
    const buffer = await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });

    // Save to all target directories
    for (const target of TARGETS) {
      const dir = join(target, "icons");
      if (!existsSync(target)) continue; // Skip if target dir doesn't exist
      mkdirSync(dir, { recursive: true });
      const path = join(dir, `icon${size}.png`);
      writeFileSync(path, buffer);
      console.log(`  saved ${path} (${size}x${size})`);
    }
  }

  await browser.close();

  // Update manifest.json files to point to icons/ subdirectory
  for (const target of TARGETS) {
    const manifestPath = join(target, "manifest.json");
    if (!existsSync(manifestPath)) continue;

    const manifest = JSON.parse(
      (await import("fs")).readFileSync(manifestPath, "utf8")
    );

    const iconMap = {};
    for (const size of SIZES) {
      iconMap[String(size)] = `icons/icon${size}.png`;
    }

    manifest.icons = iconMap;
    if (manifest.action?.default_icon) {
      manifest.action.default_icon = iconMap;
    }

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`  updated ${manifestPath}`);
  }

  console.log(`\nDone! Generated ${SIZES.length} icon sizes for ${TARGETS.length} extensions.`);
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});

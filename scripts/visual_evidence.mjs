#!/usr/bin/env node
/**
 * visual_evidence.mjs — Capture UI screenshots as visual baseline.
 *
 * Usage:
 *   # Against production (landing page only — no auth)
 *   node scripts/visual_evidence.mjs
 *
 *   # Against local E2E server (full UI with mock cards)
 *   E2E=1 BASE_URL=http://localhost:3000 node scripts/visual_evidence.mjs
 *
 * Output: reports/visual-evidence/<YYYYMMDD_HHMMSS>/
 *   - *.png screenshots
 *   - index.md (metadata + file list)
 */

import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";

const BASE_URL = process.env.BASE_URL ?? "https://stillframe-phase0.vercel.app";
const E2E_MODE = process.env.E2E === "1";
const STATE_PATH = ".auth/storageState.json";

const ts = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
const OUT_DIR = `reports/visual-evidence/${ts}`;

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "mobile", width: 390, height: 844 },
];

const files = [];

function log(msg) {
  console.log(`[evidence] ${msg}`);
}

async function capture(page, name, opts = {}) {
  const path = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  files.push({ name: `${name}.png`, description: opts.description ?? name });
  log(`  saved ${name}.png`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  log(`Output: ${OUT_DIR}/`);
  log(`BASE_URL: ${BASE_URL}`);
  log(`Mode: ${E2E_MODE ? "E2E mock" : "production (limited)"}`);

  // Bootstrap auth state if needed
  if (E2E_MODE && !existsSync(STATE_PATH)) {
    log("Bootstrapping E2E auth state...");
    try {
      execFileSync("node", ["scripts/e2e_auth_storage_state.mjs"], {
        stdio: "inherit",
        env: { ...process.env },
      });
    } catch (e) {
      console.error("[evidence] Bootstrap failed:", e.message);
      process.exit(1);
    }
  }

  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    log(`\n--- ${vp.name} (${vp.width}x${vp.height}) ---`);

    const contextOpts = {
      viewport: { width: vp.width, height: vp.height },
      ...(E2E_MODE && existsSync(STATE_PATH)
        ? { storageState: STATE_PATH }
        : {}),
    };
    const context = await browser.newContext(contextOpts);
    const page = await context.newPage();

    // 1. Landing page
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 30_000 });
      await capture(page, `${vp.name}_landing`, {
        fullPage: true,
        description: "Landing page",
      });
    } catch (e) {
      log(`  SKIP landing: ${e.message}`);
    }

    // 2-5. App pages (E2E only)
    if (E2E_MODE) {
      const appUrl = `${BASE_URL}/app?e2e=1`;
      try {
        await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(2000);

        // 2. Card grid
        await capture(page, `${vp.name}_card_grid`, {
          description: "Card grid with mock cards",
        });

        // 3. DnD handle visible (hover first card)
        const firstCard = page.locator("[data-testid=\"card-item\"]").first();
        if (await firstCard.isVisible()) {
          await firstCard.hover();
          await page.waitForTimeout(300);
          await capture(page, `${vp.name}_dnd_handle`, {
            description: "DnD grip handle visible on hover",
          });
        }

        // 4. Memo drawer open
        const memoChip = firstCard.locator("[data-testid=\"chip-memo\"]");
        if (await memoChip.isVisible()) {
          await memoChip.click();
          await page.waitForTimeout(500);
          await capture(page, `${vp.name}_memo_drawer`, {
            description: "Memo drawer (Sheet) open",
          });
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
        }

        // 5. Full-page scroll view
        await capture(page, `${vp.name}_card_grid_full`, {
          fullPage: true,
          description: "Full-page card grid",
        });
      } catch (e) {
        log(`  SKIP app: ${e.message}`);
      }
    }

    await context.close();
  }

  await browser.close();

  // Generate index.md
  const gitSha = (() => {
    try {
      return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
    } catch { return "unknown"; }
  })();

  const index = [
    `# Visual Evidence — ${new Date().toISOString()}`,
    "",
    `- **Commit**: \`${gitSha}\``,
    `- **BASE_URL**: \`${BASE_URL}\``,
    `- **Mode**: ${E2E_MODE ? "E2E mock" : "production (landing only)"}`,
    `- **Viewports**: ${VIEWPORTS.map((v) => `${v.name} (${v.width}x${v.height})`).join(", ")}`,
    "",
    "## Screenshots",
    "",
    ...files.map((f) => `- \`${f.name}\` — ${f.description}`),
    "",
    "## Reproduce",
    "",
    "```bash",
    E2E_MODE
      ? `E2E=1 npm run build && E2E=1 npm start &\nE2E=1 BASE_URL=http://localhost:3000 node scripts/visual_evidence.mjs`
      : `node scripts/visual_evidence.mjs`,
    "```",
    "",
  ].join("\n");
  writeFileSync(`${OUT_DIR}/index.md`, index);
  log(`\nindex.md written`);
  log(`Total: ${files.length} screenshots → ${OUT_DIR}/`);
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});

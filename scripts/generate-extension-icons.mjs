#!/usr/bin/env node
/**
 * Generate Chrome extension icons from public/enso.png using sharp.
 * Output: icon16.png, icon32.png, icon48.png, icon128.png
 * in both chrome-extension/ and tools/chrome-extension/save-to-shinen/
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const INPUT = resolve(root, "public/enso.png");
const SIZES = [16, 32, 48, 128];
const OUTPUT_DIRS = [
  resolve(root, "chrome-extension"),
  resolve(root, "tools/chrome-extension/save-to-shinen"),
];

async function generate() {
  const src = sharp(INPUT);
  const meta = await src.metadata();
  console.log(`Source: ${INPUT} (${meta.width}x${meta.height})`);

  for (const dir of OUTPUT_DIRS) {
    console.log(`\nOutput dir: ${dir}`);
    for (const size of SIZES) {
      const outPath = resolve(dir, `icon${size}.png`);
      await sharp(INPUT)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(outPath);

      const buf = readFileSync(outPath);
      const sha = createHash("sha256").update(buf).digest("hex").slice(0, 12);
      console.log(`  icon${size}.png  ${buf.length} bytes  sha256:${sha}`);
    }
  }
  console.log("\nDone.");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});

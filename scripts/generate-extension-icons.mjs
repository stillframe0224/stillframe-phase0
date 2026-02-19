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

// --- Polish parameters ---
// INNER_RATIO: ring occupies this fraction of the icon; rest is breathing room.
// Gives ~11% padding on each side → cleaner look at small sizes.
const INNER_RATIO = 0.78;
// Apply sharpening to sizes at or below this threshold for crisp edges.
const SHARPEN_BELOW = 48;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function generate() {
  const src = sharp(INPUT);
  const meta = await src.metadata();
  console.log(`Source: ${INPUT} (${meta.width}x${meta.height})`);
  console.log(`Polish: innerRatio=${INNER_RATIO} sharpenBelow=${SHARPEN_BELOW}`);

  for (const dir of OUTPUT_DIRS) {
    console.log(`\nOutput dir: ${dir}`);
    for (const size of SIZES) {
      const outPath = resolve(dir, `icon${size}.png`);
      const innerSize = Math.round(size * INNER_RATIO);
      const padTop = Math.round((size - innerSize) / 2);
      const padLeft = padTop;

      let pipeline = sharp(INPUT)
        .resize(innerSize, innerSize, {
          fit: "contain",
          background: TRANSPARENT,
        })
        .extend({
          top: padTop,
          bottom: size - innerSize - padTop,
          left: padLeft,
          right: size - innerSize - padLeft,
          background: TRANSPARENT,
        });

      if (size <= SHARPEN_BELOW) {
        pipeline = pipeline.sharpen({ sigma: 0.5 });
      }

      await pipeline.png().toFile(outPath);

      const buf = readFileSync(outPath);
      const sha = createHash("sha256").update(buf).digest("hex").slice(0, 12);
      console.log(`  icon${size}.png  ${buf.length} bytes  sha256:${sha} (inner=${innerSize} pad=${padTop})`);
    }
  }
  console.log("\nDone.");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});

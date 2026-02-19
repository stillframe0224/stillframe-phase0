#!/bin/bash
# Generate extension icons from public/enso.png using sharp.
# Requires: npm install (sharp is a devDependency)
cd "$(dirname "$0")/../../.." && node scripts/generate-extension-icons.mjs

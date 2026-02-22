import test from "node:test";

// tunnelArrange.js and tunnelStateGuards.js were removed in the shinen-v17 rewrite.
// These tests validated the legacy tunnel layout system which has been replaced by
// shinen/lib/layouts.ts with 5 new layout algorithms (scatter, grid, circle, tiles, triangle).

test("legacy tunnel arrange tests: skipped (v17 rewrite)", { skip: "tunnel system replaced by shinen-v17" }, () => {});

/** SHINEN v17 constants — single source of truth */

export const TYPES = [
  { glow: "#D94F4F", label: "melody" },
  { glow: "#4F6ED9", label: "idea" },
  { glow: "#A89620", label: "quote" },
  { glow: "#2D8F50", label: "task" },
  { glow: "#C07820", label: "feeling" },
  { glow: "#7B4FD9", label: "image" },
  { glow: "#208F78", label: "fragment" },
  { glow: "#C04890", label: "dream" },
  { glow: "#555555", label: "clip" },
  { glow: "#666666", label: "file" },
] as const;

export const PERSP = 1100;
export const Z_MIN = -550;
export const Z_MAX = 600;
export const SLAB_N = 2;
export const SLAB_GAP = 0.9;

export const TILE_GX = 180;
export const TILE_GY = 130;
export const GRID_COLS = 16;
export const GRID_ROWS = 14;

export const ZOOM_MIN = -400;
export const ZOOM_MAX = 500;

export const CARD_WIDTH_DESKTOP = 210;
export const CARD_WIDTH_MOBILE = 170; // floor of 45vw at 375px

/** Returns responsive card width: min(210, 45vw) */
export function getCardWidth(): number {
  if (typeof window === "undefined") return CARD_WIDTH_DESKTOP;
  return Math.min(CARD_WIDTH_DESKTOP, window.innerWidth * 0.45);
}

/** Tap-target minimum size (px) per mobile a11y guidelines */
export const TAP_TARGET_MIN = 44;

export const LAYOUTS = ["scatter", "grid", "circle", "tiles", "triangle"] as const;
export type LayoutName = (typeof LAYOUTS)[number];

export const INITIAL_CARDS = [
  { id: 1, type: 0, text: "Am7 \u2192 Dm9 \u2192 G13\nfeels like dusk", px: -320, py: -90, z: -30 },
  { id: 2, type: 1, text: "Character who only\nspeaks in questions", px: 200, py: -150, z: -160 },
  { id: 3, type: 2, text: '"The only way out\nis through" \u2014 Frost', px: -90, py: 120, z: -300 },
  { id: 4, type: 3, text: "Fix the bridge section\nbefore Friday", px: 350, py: 40, z: -100 },
  { id: 5, type: 4, text: "Restless but not anxious\n\u2014 what is this?", px: -380, py: -200, z: -380 },
  { id: 6, type: 5, text: "That specific blue\nin Vermeer's Girl", px: 50, py: 150, z: -50 },
  { id: 7, type: 6, text: "\u534a\u5206\u3060\u3051\u899a\u3048\u3066\u308b\n\u3042\u306e\u30e1\u30ed\u30c7\u30a3", px: -190, py: 30, z: -220 },
  { id: 8, type: 7, text: "A city where buildings\ngrow like trees", px: 280, py: -40, z: -440 },
  { id: 9, type: 1, text: "Polyrhythm engine\nfor 7/8 + 5/4", px: -40, py: -190, z: -140 },
  { id: 10, type: 0, text: "Rain on copper rooftops\nat 3am tempo", px: 200, py: 130, z: -270 },
  { id: 11, type: 5, text: "\u5149\u306e\u7c92\u5b50\u304c\n\u6c34\u9762\u306b\u89e6\u308c\u308b\u77ac\u9593", px: -270, py: 90, z: -480 },
  { id: 12, type: 7, text: "Library that exists\nonly at twilight", px: 130, py: -100, z: -190 },
] as const;

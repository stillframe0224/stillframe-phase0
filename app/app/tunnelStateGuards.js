const KNOWN_LAYOUTS = new Set(["scatter", "grid", "circle", "cluster"]);

export function normalizeTunnelLayout(layout) {
  return KNOWN_LAYOUTS.has(layout) ? layout : "scatter";
}

export function hasFiniteCamera(camera) {
  return !!camera &&
    Number.isFinite(camera.x) &&
    Number.isFinite(camera.y) &&
    Number.isFinite(camera.zoom);
}

export function hasFinitePositions(positions) {
  if (!positions || typeof positions !== "object") return false;
  for (const value of Object.values(positions)) {
    if (
      !value ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y) ||
      !Number.isFinite(value.z)
    ) {
      return false;
    }
  }
  return true;
}

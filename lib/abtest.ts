/**
 * Lightweight A/B test assignment.
 * Assigns a sticky variant per experiment via localStorage.
 * SSR-safe: returns "A" on server.
 */

export type Variant = "A" | "B";

const STORAGE_PREFIX = "shinen_ab_";

export function getVariant(experiment: string): Variant {
  if (typeof window === "undefined") return "A";

  const key = STORAGE_PREFIX + experiment;
  try {
    const stored = localStorage.getItem(key);
    if (stored === "A" || stored === "B") return stored;

    const variant: Variant = Math.random() < 0.5 ? "A" : "B";
    localStorage.setItem(key, variant);
    return variant;
  } catch {
    return "A";
  }
}

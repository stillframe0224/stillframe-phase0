/**
 * tunnelPerfMonitor.ts — Frame time monitoring with hysteresis.
 * Pure functions, no side effects.
 *
 * Quality levels (degradation order): full → no-shadow → no-3d → no-anim
 * Degrade: 3 consecutive frames > 16ms
 * Recover: 30 consecutive frames < 12ms → step up one level
 */

export type QualityTier = "full" | "no-shadow" | "no-3d" | "no-anim";

const TIERS: QualityTier[] = ["full", "no-shadow", "no-3d", "no-anim"];

const DEGRADE_THRESHOLD_MS = 16;
const DEGRADE_COUNT = 3;
const RECOVER_THRESHOLD_MS = 12;
const RECOVER_COUNT = 30;
const RING_SIZE = 10;

export interface PerfMonitor {
  tier: QualityTier;
  ring: number[];       // ring buffer of frame deltas (ms)
  ringIndex: number;
  slowStreak: number;   // consecutive frames > DEGRADE_THRESHOLD_MS
  fastStreak: number;   // consecutive frames < RECOVER_THRESHOLD_MS
}

export function createPerfMonitor(initialTier?: QualityTier): PerfMonitor {
  return {
    tier: initialTier ?? "full",
    ring: new Array(RING_SIZE).fill(0),
    ringIndex: 0,
    slowStreak: 0,
    fastStreak: 0,
  };
}

export function recordFrameTime(monitor: PerfMonitor, deltaMs: number): PerfMonitor {
  const ring = [...monitor.ring];
  ring[monitor.ringIndex % RING_SIZE] = deltaMs;
  const ringIndex = monitor.ringIndex + 1;

  let slowStreak = monitor.slowStreak;
  let fastStreak = monitor.fastStreak;

  if (deltaMs > DEGRADE_THRESHOLD_MS) {
    slowStreak++;
    fastStreak = 0;
  } else if (deltaMs < RECOVER_THRESHOLD_MS) {
    fastStreak++;
    slowStreak = 0;
  } else {
    // Between 12-16ms: reset both streaks
    slowStreak = 0;
    fastStreak = 0;
  }

  let tier = monitor.tier;

  // Degrade: 3 consecutive slow frames → step down
  if (slowStreak >= DEGRADE_COUNT) {
    const tierIdx = TIERS.indexOf(tier);
    if (tierIdx < TIERS.length - 1) {
      tier = TIERS[tierIdx + 1];
      slowStreak = 0;
      fastStreak = 0;
    }
  }

  // Recover: 30 consecutive fast frames → step up
  if (fastStreak >= RECOVER_COUNT) {
    const tierIdx = TIERS.indexOf(tier);
    if (tierIdx > 0) {
      tier = TIERS[tierIdx - 1];
      fastStreak = 0;
      slowStreak = 0;
    }
  }

  return { tier, ring, ringIndex, slowStreak, fastStreak };
}

/** CSS class name for current quality tier */
export function tierCssClass(tier: QualityTier): string {
  if (tier === "full") return "";
  return `perf-${tier}`;
}

/** Check if device is likely low-end mobile */
export function isLowEndMobile(): boolean {
  if (typeof window === "undefined") return false;
  return navigator.maxTouchPoints > 0 && window.innerWidth < 768;
}

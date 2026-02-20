import { describe, it, expect } from "vitest";
import {
  createPerfMonitor,
  recordFrameTime,
  tierCssClass,
} from "../app/app/tunnelPerfMonitor";

describe("tunnelPerfMonitor", () => {
  it("starts at full quality by default", () => {
    const m = createPerfMonitor();
    expect(m.tier).toBe("full");
    expect(m.slowStreak).toBe(0);
    expect(m.fastStreak).toBe(0);
  });

  it("can start at a custom tier", () => {
    const m = createPerfMonitor("no-shadow");
    expect(m.tier).toBe("no-shadow");
  });

  it("does not degrade on fast frames", () => {
    let m = createPerfMonitor();
    for (let i = 0; i < 100; i++) {
      m = recordFrameTime(m, 8); // well under 16ms
    }
    expect(m.tier).toBe("full");
  });

  it("degrades after 3 consecutive slow frames", () => {
    let m = createPerfMonitor();
    // 2 slow frames: no change
    m = recordFrameTime(m, 20);
    m = recordFrameTime(m, 20);
    expect(m.tier).toBe("full");
    // 3rd slow frame: degrade
    m = recordFrameTime(m, 20);
    expect(m.tier).toBe("no-shadow");
  });

  it("follows degradation order: full → no-shadow → no-3d → no-anim", () => {
    let m = createPerfMonitor();
    // Degrade to no-shadow
    for (let i = 0; i < 3; i++) m = recordFrameTime(m, 20);
    expect(m.tier).toBe("no-shadow");
    // Degrade to no-3d
    for (let i = 0; i < 3; i++) m = recordFrameTime(m, 20);
    expect(m.tier).toBe("no-3d");
    // Degrade to no-anim
    for (let i = 0; i < 3; i++) m = recordFrameTime(m, 20);
    expect(m.tier).toBe("no-anim");
    // No further degradation
    for (let i = 0; i < 3; i++) m = recordFrameTime(m, 20);
    expect(m.tier).toBe("no-anim");
  });

  it("recovers after 30 consecutive fast frames (< 12ms)", () => {
    let m = createPerfMonitor("no-shadow");
    // 29 fast frames: no recovery
    for (let i = 0; i < 29; i++) {
      m = recordFrameTime(m, 10);
    }
    expect(m.tier).toBe("no-shadow");
    // 30th fast frame: recover
    m = recordFrameTime(m, 10);
    expect(m.tier).toBe("full");
  });

  it("does NOT recover on frames between 12ms and 16ms (hysteresis)", () => {
    let m = createPerfMonitor("no-shadow");
    // 30 frames at 14ms (between 12ms and 16ms): no recovery
    for (let i = 0; i < 30; i++) {
      m = recordFrameTime(m, 14);
    }
    expect(m.tier).toBe("no-shadow");
  });

  it("recovery resets on a single slow frame", () => {
    let m = createPerfMonitor("no-shadow");
    // 25 fast frames
    for (let i = 0; i < 25; i++) {
      m = recordFrameTime(m, 10);
    }
    // 1 slow frame resets
    m = recordFrameTime(m, 20);
    expect(m.fastStreak).toBe(0);
    // Need 30 more fast frames
    for (let i = 0; i < 29; i++) {
      m = recordFrameTime(m, 10);
    }
    expect(m.tier).toBe("no-shadow");
    m = recordFrameTime(m, 10);
    expect(m.tier).toBe("full");
  });

  it("step-by-step recovery through multiple tiers", () => {
    let m = createPerfMonitor("no-anim");
    // Recover one step: no-anim → no-3d
    for (let i = 0; i < 30; i++) m = recordFrameTime(m, 8);
    expect(m.tier).toBe("no-3d");
    // Recover another step: no-3d → no-shadow
    for (let i = 0; i < 30; i++) m = recordFrameTime(m, 8);
    expect(m.tier).toBe("no-shadow");
    // Recover final step: no-shadow → full
    for (let i = 0; i < 30; i++) m = recordFrameTime(m, 8);
    expect(m.tier).toBe("full");
  });
});

describe("tierCssClass", () => {
  it('returns empty string for "full"', () => {
    expect(tierCssClass("full")).toBe("");
  });

  it("returns correct class for each tier", () => {
    expect(tierCssClass("no-shadow")).toBe("perf-no-shadow");
    expect(tierCssClass("no-3d")).toBe("perf-no-3d");
    expect(tierCssClass("no-anim")).toBe("perf-no-anim");
  });
});

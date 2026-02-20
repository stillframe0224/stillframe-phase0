import { describe, it, expect } from "vitest";
import { createFSMContext, transition, type FSMContext } from "../app/app/tunnelDragFSM";

describe("tunnelDragFSM", () => {
  it("starts in idle state", () => {
    const ctx = createFSMContext();
    expect(ctx.state).toBe("idle");
    expect(ctx.layoutLock).toBe(false);
    expect(ctx.pendingReset).toBe(false);
    expect(ctx.activeCardId).toBeNull();
  });

  it("idle + DRAG_START → dragging with layoutLock", () => {
    const ctx = createFSMContext();
    const next = transition(ctx, { type: "DRAG_START", cardId: "c1" });
    expect(next.state).toBe("dragging");
    expect(next.layoutLock).toBe(true);
    expect(next.activeCardId).toBe("c1");
  });

  it("idle + RESET_REQUEST → stays idle (execute immediately)", () => {
    const ctx = createFSMContext();
    const next = transition(ctx, { type: "RESET_REQUEST" });
    expect(next.state).toBe("idle");
    expect(next.pendingReset).toBe(false);
  });

  it("dragging + RESET_REQUEST → queues one reset", () => {
    let ctx = createFSMContext();
    ctx = transition(ctx, { type: "DRAG_START", cardId: "c1" });
    const next = transition(ctx, { type: "RESET_REQUEST" });
    expect(next.state).toBe("dragging");
    expect(next.pendingReset).toBe(true);
  });

  it("dragging + multiple RESET_REQUEST → still only 1 queued", () => {
    let ctx = createFSMContext();
    ctx = transition(ctx, { type: "DRAG_START", cardId: "c1" });
    ctx = transition(ctx, { type: "RESET_REQUEST" });
    ctx = transition(ctx, { type: "RESET_REQUEST" });
    ctx = transition(ctx, { type: "RESET_REQUEST" });
    expect(ctx.pendingReset).toBe(true);
  });

  it("dragging + DRAG_END → settling", () => {
    let ctx = createFSMContext();
    ctx = transition(ctx, { type: "DRAG_START", cardId: "c1" });
    const next = transition(ctx, { type: "DRAG_END", cardId: "c1" });
    expect(next.state).toBe("settling");
    expect(next.activeCardId).toBeNull();
  });

  it("settling + SETTLE_COMPLETE → idle, passes through pendingReset", () => {
    let ctx = createFSMContext();
    ctx = transition(ctx, { type: "DRAG_START", cardId: "c1" });
    ctx = transition(ctx, { type: "RESET_REQUEST" });
    ctx = transition(ctx, { type: "DRAG_END", cardId: "c1" });
    expect(ctx.state).toBe("settling");
    expect(ctx.pendingReset).toBe(true);

    const next = transition(ctx, { type: "SETTLE_COMPLETE" });
    expect(next.state).toBe("idle");
    expect(next.layoutLock).toBe(false);
    // pendingReset is preserved for caller to check
    expect(next.pendingReset).toBe(true);
  });

  it("settling + DRAG_START → dragging (cancel settle, drag wins)", () => {
    let ctx = createFSMContext();
    ctx = transition(ctx, { type: "DRAG_START", cardId: "c1" });
    ctx = transition(ctx, { type: "DRAG_END", cardId: "c1" });
    expect(ctx.state).toBe("settling");

    const next = transition(ctx, { type: "DRAG_START", cardId: "c2" });
    expect(next.state).toBe("dragging");
    expect(next.layoutLock).toBe(true);
    expect(next.activeCardId).toBe("c2");
  });

  it("settling + DRAG_START preserves pendingReset", () => {
    let ctx = createFSMContext();
    ctx = transition(ctx, { type: "DRAG_START", cardId: "c1" });
    ctx = transition(ctx, { type: "RESET_REQUEST" });
    ctx = transition(ctx, { type: "DRAG_END", cardId: "c1" });
    expect(ctx.pendingReset).toBe(true);

    const next = transition(ctx, { type: "DRAG_START", cardId: "c2" });
    expect(next.state).toBe("dragging");
    expect(next.pendingReset).toBe(true);
  });

  it("ignores invalid events in each state", () => {
    let ctx = createFSMContext();
    // idle: ignore DRAG_END, SETTLE_COMPLETE
    expect(transition(ctx, { type: "DRAG_END", cardId: "c1" })).toBe(ctx);
    expect(transition(ctx, { type: "SETTLE_COMPLETE" })).toBe(ctx);

    // dragging: ignore SETTLE_COMPLETE
    ctx = transition(ctx, { type: "DRAG_START", cardId: "c1" });
    expect(transition(ctx, { type: "SETTLE_COMPLETE" })).toBe(ctx);
  });
});

/**
 * tunnelDragFSM.ts — Drag/layout coordination state machine.
 * Pure functions, no side effects.
 *
 * States: idle | dragging | settling
 * Events: DRAG_START | DRAG_END | SETTLE_COMPLETE | RESET_REQUEST
 */

export type FSMState = "idle" | "dragging" | "settling";

export type FSMEvent =
  | { type: "DRAG_START"; cardId: string }
  | { type: "DRAG_END"; cardId: string }
  | { type: "SETTLE_COMPLETE" }
  | { type: "RESET_REQUEST" };

export interface FSMContext {
  state: FSMState;
  layoutLock: boolean;
  pendingReset: boolean;
  activeCardId: string | null;
}

export function createFSMContext(): FSMContext {
  return {
    state: "idle",
    layoutLock: false,
    pendingReset: false,
    activeCardId: null,
  };
}

export function transition(ctx: FSMContext, event: FSMEvent): FSMContext {
  switch (ctx.state) {
    case "idle":
      switch (event.type) {
        case "DRAG_START":
          return {
            state: "dragging",
            layoutLock: true,
            pendingReset: false,
            activeCardId: event.cardId,
          };
        case "RESET_REQUEST":
          // Execute immediately — caller should run autoArrange
          return { ...ctx, pendingReset: false };
        default:
          return ctx;
      }

    case "dragging":
      switch (event.type) {
        case "RESET_REQUEST":
          // Queue at most one reset
          return { ...ctx, pendingReset: true };
        case "DRAG_END":
          return {
            ...ctx,
            state: "settling",
            activeCardId: null,
          };
        default:
          return ctx;
      }

    case "settling":
      switch (event.type) {
        case "SETTLE_COMPLETE":
          return {
            state: "idle",
            layoutLock: false,
            pendingReset: ctx.pendingReset,
            activeCardId: null,
          };
        case "DRAG_START":
          // Cancel settle, drag wins
          return {
            state: "dragging",
            layoutLock: true,
            pendingReset: ctx.pendingReset,
            activeCardId: event.cardId,
          };
        default:
          return ctx;
      }

    default:
      return ctx;
  }
}

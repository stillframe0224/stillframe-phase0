"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  autoArrange,
  CARD_DEFAULT_W,
  CARD_DEFAULT_H,
  type Position3D,
} from "./tunnelLayout";

export type { Position3D };

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface TunnelState {
  positions: Record<string, Position3D>;
  camera: CameraState;
  layout: string; // "auto-v1" (kept for storage compat)
}

export type PersistError = "quota" | "corrupt" | null;

function getStorageKey(userId: string): string {
  return `stillframe.tunnel.v1:${userId}`;
}

function buildCardSizes(
  cardIds: string[],
  sizes?: Map<string, { w: number; h: number }>
): Map<string, { w: number; h: number }> {
  const result = new Map<string, { w: number; h: number }>();
  for (const id of cardIds) {
    const measured = sizes?.get(id);
    result.set(id, measured ?? { w: CARD_DEFAULT_W, h: CARD_DEFAULT_H });
  }
  return result;
}

/**
 * Load tunnel state from localStorage.
 * Returns the parsed TunnelState on success, null if nothing saved,
 * or { error: "corrupt" } if the stored data is malformed.
 */
function loadState(userId: string): TunnelState | { error: "corrupt" } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TunnelState;
    // Minimal schema validation — positions and camera must be objects
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.positions !== "object" ||
      typeof parsed.camera !== "object"
    ) {
      return { error: "corrupt" };
    }
    // Normalize old layout values to auto-v1
    if (
      (parsed as { layout?: string }).layout !== "auto-v1"
    ) {
      parsed.layout = "auto-v1";
    }
    return parsed;
  } catch {
    return { error: "corrupt" };
  }
}

/**
 * Save tunnel state to localStorage.
 * Returns null on success, "quota" if storage is full, "unknown" for other errors.
 */
function saveState(userId: string, state: TunnelState): "quota" | "unknown" | null {
  if (typeof window === "undefined") return null;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
    return null; // success
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err.code === 22)
    ) {
      return "quota";
    }
    return "unknown";
  }
}

export function useTunnelStore(userId: string, cardIds: string[]) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<TunnelState | null>(null);

  // Track last-warned error type so we console.warn only once per distinct error
  const lastWarnedErrorRef = useRef<PersistError>(null);

  const [persistError, setPersistError] = useState<PersistError>(null);

  const [state, setState] = useState<TunnelState>(() => {
    const loaded = loadState(userId);
    const viewW = typeof window !== "undefined" ? window.innerWidth : 1200;
    const viewH = typeof window !== "undefined" ? window.innerHeight - 160 : 700;

    // Corrupt data: start fresh, error will be surfaced via useEffect
    if (loaded !== null && "error" in loaded) {
      const sizes = buildCardSizes(cardIds);
      const initial: TunnelState = {
        positions: autoArrange(sizes, viewW, viewH).positions,
        camera: { x: 0, y: 0, zoom: 1 },
        layout: "auto-v1",
      };
      stateRef.current = initial;
      return initial;
    }

    if (loaded) {
      // Ensure any new cards get positioned
      let hasNew = false;
      cardIds.forEach((id) => {
        if (!loaded.positions[id]) {
          hasNew = true;
        }
      });
      if (hasNew) {
        // Recompute full layout with all cards
        const sizes = buildCardSizes(cardIds);
        const { positions: newPositions } = autoArrange(sizes, viewW, viewH);
        const result = { ...loaded, positions: newPositions, layout: "auto-v1" as const };
        stateRef.current = result;
        return result;
      }
      stateRef.current = loaded;
      return loaded;
    }

    const sizes = buildCardSizes(cardIds);
    const initial: TunnelState = {
      positions: autoArrange(sizes, viewW, viewH).positions,
      camera: { x: 0, y: 0, zoom: 1 },
      layout: "auto-v1",
    };
    stateRef.current = initial;
    return initial;
  });

  // Surface corrupt-load error after mount (useState initializer runs before effects)
  useEffect(() => {
    const loaded = loadState(userId);
    if (loaded !== null && "error" in loaded) {
      if (lastWarnedErrorRef.current !== "corrupt") {
        console.warn("[tunnel] localStorage data is corrupt — starting fresh");
        lastWarnedErrorRef.current = "corrupt";
      }
      setPersistError("corrupt");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Keep ref in sync
  stateRef.current = state;

  // Handle new cards appearing
  useEffect(() => {
    const viewW = window.innerWidth;
    const viewH = window.innerHeight - 160;
    const current = stateRef.current;
    if (!current) return;
    let hasNew = false;
    cardIds.forEach((id) => {
      if (!current.positions[id]) {
        hasNew = true;
      }
    });
    if (hasNew) {
      const sizes = buildCardSizes(cardIds);
      const { positions } = autoArrange(sizes, viewW, viewH);
      setState((prev) => {
        const next = { ...prev, positions };
        debouncedSave(next);
        return next;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIds.join(",")]);

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const debouncedSave = useCallback(
    (s: TunnelState) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const err = saveState(userId, s);
        if (err === "quota") {
          if (lastWarnedErrorRef.current !== "quota") {
            console.warn("[tunnel] localStorage quota exceeded — tunnel state not saved");
            lastWarnedErrorRef.current = "quota";
          }
          setPersistError("quota");
        } else if (err === "unknown") {
          if (lastWarnedErrorRef.current !== "quota") {
            console.warn("[tunnel] localStorage write failed — tunnel state not saved");
          }
          setPersistError("quota"); // surface as quota to user (same UX)
        } else {
          // Success — clear error
          if (lastWarnedErrorRef.current !== null) {
            lastWarnedErrorRef.current = null;
          }
          setPersistError(null);
        }
      }, 300);
    },
    [userId]
  );

  const setCardPosition = useCallback(
    (cardId: string, pos: Position3D) => {
      setState((prev) => {
        const next = {
          ...prev,
          positions: { ...prev.positions, [cardId]: pos },
        };
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave]
  );

  const setCamera = useCallback(
    (cam: CameraState) => {
      setState((prev) => {
        const next = { ...prev, camera: cam };
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave]
  );

  /** Rearrange cards without resetting camera */
  const arrangeCards = useCallback(
    (cardSizes?: Map<string, { w: number; h: number }>) => {
      const viewW = window.innerWidth;
      const viewH = window.innerHeight - 160;
      const sizes = buildCardSizes(cardIds, cardSizes);
      const { positions } = autoArrange(sizes, viewW, viewH);
      setState((prev) => {
        const next = { ...prev, positions };
        debouncedSave(next);
        return next;
      });
    },
    [cardIds, debouncedSave]
  );

  /** Reset everything: camera + card positions */
  const resetAll = useCallback(
    (cardSizes?: Map<string, { w: number; h: number }>) => {
      const viewW = window.innerWidth;
      const viewH = window.innerHeight - 160;
      const sizes = buildCardSizes(cardIds, cardSizes);
      const initial: TunnelState = {
        positions: autoArrange(sizes, viewW, viewH).positions,
        camera: { x: 0, y: 0, zoom: 1 },
        layout: "auto-v1",
      };
      setState(initial);
      debouncedSave(initial);
    },
    [cardIds, debouncedSave]
  );

  return {
    positions: state.positions,
    camera: state.camera,
    persistError,
    setCardPosition,
    setCamera,
    arrangeCards,
    resetAll,
  };
}

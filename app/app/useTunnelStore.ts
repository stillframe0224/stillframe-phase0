"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type TunnelLayout = "scatter" | "grid" | "circle";

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface TunnelState {
  positions: Record<string, Position3D>;
  camera: CameraState;
  layout: TunnelLayout;
}

const LAYOUT_ORDER: TunnelLayout[] = ["scatter", "grid", "circle"];

function getStorageKey(userId: string): string {
  return `stillframe.tunnel.v1:${userId}`;
}

/** Simple hash from string to number in [0, 1) */
function hashToFloat(str: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

function scatterPosition(cardId: string, viewW: number, viewH: number): Position3D {
  const padX = 140;
  const padY = 100;
  const x = padX + hashToFloat(cardId, 1) * Math.max(viewW - padX * 2, 200);
  const y = padY + hashToFloat(cardId, 2) * Math.max(viewH - padY * 2, 200);
  const z = hashToFloat(cardId, 3) * 100 - 50; // -50 to +50
  return { x, y, z };
}

function gridPositions(cardIds: string[]): Record<string, Position3D> {
  const cols = Math.max(Math.ceil(Math.sqrt(cardIds.length)), 1);
  const gapX = 280;
  const gapY = 320;
  const offsetX = 80;
  const offsetY = 80;
  const result: Record<string, Position3D> = {};
  cardIds.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    result[id] = { x: offsetX + col * gapX, y: offsetY + row * gapY, z: 0 };
  });
  return result;
}

function circlePositions(cardIds: string[]): Record<string, Position3D> {
  const cx = typeof window !== "undefined" ? window.innerWidth / 2 - 120 : 600;
  const cy = typeof window !== "undefined" ? (window.innerHeight - 160) / 2 - 140 : 300;
  const radius = Math.min(cx, cy) * 0.6;
  const result: Record<string, Position3D> = {};
  cardIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / cardIds.length - Math.PI / 2;
    result[id] = {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      z: 0,
    };
  });
  return result;
}

function computeLayout(
  layout: TunnelLayout,
  cardIds: string[],
  viewW: number,
  viewH: number
): Record<string, Position3D> {
  switch (layout) {
    case "grid":
      return gridPositions(cardIds);
    case "circle":
      return circlePositions(cardIds);
    case "scatter":
    default: {
      const result: Record<string, Position3D> = {};
      cardIds.forEach((id) => {
        result[id] = scatterPosition(id, viewW, viewH);
      });
      return result;
    }
  }
}

function loadState(userId: string): TunnelState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as TunnelState;
  } catch {
    return null;
  }
}

function saveState(userId: string, state: TunnelState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch {
    // quota exceeded — silent
  }
}

export function useTunnelStore(userId: string, cardIds: string[]) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<TunnelState | null>(null);

  const [state, setState] = useState<TunnelState>(() => {
    const saved = loadState(userId);
    const viewW = typeof window !== "undefined" ? window.innerWidth : 1200;
    const viewH = typeof window !== "undefined" ? window.innerHeight - 160 : 700;

    if (saved) {
      // Ensure any new cards get positioned
      const positions = { ...saved.positions };
      let hasNew = false;
      cardIds.forEach((id) => {
        if (!positions[id]) {
          positions[id] = scatterPosition(id, viewW, viewH);
          hasNew = true;
        }
      });
      const result = hasNew ? { ...saved, positions } : saved;
      stateRef.current = result;
      return result;
    }

    const initial: TunnelState = {
      positions: computeLayout("scatter", cardIds, viewW, viewH),
      camera: { x: 0, y: 0, zoom: 1 },
      layout: "scatter",
    };
    stateRef.current = initial;
    return initial;
  });

  // Keep ref in sync
  stateRef.current = state;

  // Handle new cards appearing
  useEffect(() => {
    const viewW = window.innerWidth;
    const viewH = window.innerHeight - 160;
    const current = stateRef.current;
    if (!current) return;
    const positions = { ...current.positions };
    let hasNew = false;
    cardIds.forEach((id) => {
      if (!positions[id]) {
        if (current.layout === "scatter") {
          positions[id] = scatterPosition(id, viewW, viewH);
        } else {
          // Recompute full layout when in grid/circle
          const all = computeLayout(current.layout, cardIds, viewW, viewH);
          setState((prev) => {
            const next = { ...prev, positions: all };
            debouncedSave(next);
            return next;
          });
          return;
        }
        hasNew = true;
      }
    });
    if (hasNew) {
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
        saveState(userId, s);
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

  const cycleLayout = useCallback(() => {
    setState((prev) => {
      const idx = LAYOUT_ORDER.indexOf(prev.layout);
      const nextLayout = LAYOUT_ORDER[(idx + 1) % LAYOUT_ORDER.length];
      const viewW = window.innerWidth;
      const viewH = window.innerHeight - 160;
      const positions = computeLayout(nextLayout, cardIds, viewW, viewH);
      const next: TunnelState = { ...prev, layout: nextLayout, positions };
      debouncedSave(next);
      return next;
    });
  }, [cardIds, debouncedSave]);

  const resetAll = useCallback(() => {
    const viewW = window.innerWidth;
    const viewH = window.innerHeight - 160;
    const initial: TunnelState = {
      positions: computeLayout("scatter", cardIds, viewW, viewH),
      camera: { x: 0, y: 0, zoom: 1 },
      layout: "scatter",
    };
    setState(initial);
    debouncedSave(initial);
  }, [cardIds, debouncedSave]);

  return {
    positions: state.positions,
    camera: state.camera,
    layout: state.layout,
    setCardPosition,
    setCamera,
    cycleLayout,
    resetAll,
  };
}

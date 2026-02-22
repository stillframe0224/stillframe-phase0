import { useState, useEffect, useCallback, useRef } from "react";
import { proj } from "../lib/projection";
import { getCardWidth, Z_MIN, Z_MAX } from "../lib/constants";
import type { ShinenCard, SelectionRect, CameraState } from "../lib/types";

export function useSelection(
  cards: ShinenCard[],
  setCards: React.Dispatch<React.SetStateAction<ShinenCard[]>>,
  cam: CameraState,
  zoom: number,
) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selRect, setSelRect] = useState<SelectionRect | null>(null);

  // Use refs for values needed in window listeners to avoid stale closures
  const selStartRef = useRef<{ x: number; y: number } | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const camRef = useRef(cam);
  camRef.current = cam;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const startSelection = useCallback((e: React.PointerEvent) => {
    const start = { x: e.clientX, y: e.clientY };
    selStartRef.current = start;
    setSelRect({
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY,
    });
  }, []);

  // Selection rect drag — attach/detach listeners only when selRect is active
  useEffect(() => {
    if (!selRect) return;

    const onMove = (e: PointerEvent) => {
      setSelRect((prev) => (prev ? { ...prev, curX: e.clientX, curY: e.clientY } : null));
    };

    const onUp = (e: PointerEvent) => {
      const start = selStartRef.current;
      if (start) {
        const rect = normalizeRect(start.x, start.y, e.clientX, e.clientY);

        // If the rect is tiny (< 5px in either dimension), treat as a background click → clear selection
        if (rect.w < 5 && rect.h < 5) {
          setSelected(new Set());
        } else {
          // Hit-test cards against the selection rect
          const hits = new Set<number>();
          const cx = window.innerWidth / 2;
          const cy = window.innerHeight / 2;
          const currentCards = cardsRef.current;
          const currentCam = camRef.current;
          const currentZoom = zoomRef.current;

          currentCards.forEach((card) => {
            const p = proj(card.px, card.py, card.z + currentZoom, currentCam.rx, currentCam.ry);
            const cardCenterX = cx + p.sx;
            const cardCenterY = cy + p.sy;
            const halfW = (getCardWidth() * p.s) / 2;
            const halfH = halfW * 0.7;
            if (
              cardCenterX + halfW > rect.x &&
              cardCenterX - halfW < rect.x + rect.w &&
              cardCenterY + halfH > rect.y &&
              cardCenterY - halfH < rect.y + rect.h
            ) {
              hits.add(card.id);
            }
          });
          setSelected(hits);
        }
      }
      selStartRef.current = null;
      setSelRect(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [selRect !== null]); // Only re-attach when transitioning null <-> non-null

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const deleteSelected = useCallback(() => {
    setCards((prev) => prev.filter((c) => !selected.has(c.id)));
    setSelected(new Set());
  }, [selected, setCards]);

  const changeSelectedZ = useCallback(
    (delta: number) => {
      setCards((prev) =>
        prev.map((c) =>
          selected.has(c.id) ? { ...c, z: Math.max(Z_MIN, Math.min(Z_MAX, c.z - delta * 0.8)) } : c,
        ),
      );
    },
    [selected, setCards],
  );

  // Touch-compatible selection methods (called from useTouch)
  const startSelectionAt = useCallback((x: number, y: number) => {
    selStartRef.current = { x, y };
    setSelRect({ startX: x, startY: y, curX: x, curY: y });
  }, []);

  const moveSelectionTo = useCallback((x: number, y: number) => {
    setSelRect((prev) => (prev ? { ...prev, curX: x, curY: y } : null));
  }, []);

  const endSelectionAt = useCallback((x: number, y: number) => {
    const start = selStartRef.current;
    if (start) {
      const rect = normalizeRect(start.x, start.y, x, y);
      if (rect.w < 5 && rect.h < 5) {
        setSelected(new Set());
      } else {
        const hits = new Set<number>();
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const currentCards = cardsRef.current;
        const currentCam = camRef.current;
        const currentZoom = zoomRef.current;
        currentCards.forEach((card) => {
          const p = proj(card.px, card.py, card.z + currentZoom, currentCam.rx, currentCam.ry);
          const cardCenterX = cx + p.sx;
          const cardCenterY = cy + p.sy;
          const halfW = (getCardWidth() * p.s) / 2;
          const halfH = halfW * 0.7;
          if (
            cardCenterX + halfW > rect.x &&
            cardCenterX - halfW < rect.x + rect.w &&
            cardCenterY + halfH > rect.y &&
            cardCenterY - halfH < rect.y + rect.h
          ) {
            hits.add(card.id);
          }
        });
        setSelected(hits);
      }
    }
    selStartRef.current = null;
    setSelRect(null);
  }, []);

  return {
    selected, selRect, startSelection, clearSelection,
    deleteSelected, changeSelectedZ, setSelected,
    startSelectionAt, moveSelectionTo, endSelectionAt,
  };
}

function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

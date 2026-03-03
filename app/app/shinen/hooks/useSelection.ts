import { useState, useEffect, useCallback, useRef } from "react";
import { getCardWidth } from "../lib/constants";
import type { ShinenCard, SelectionRect } from "../lib/types";

export function useSelection(
  cards: ShinenCard[],
  setCards: React.Dispatch<React.SetStateAction<ShinenCard[]>>,
) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selRect, setSelRect] = useState<SelectionRect | null>(null);

  // Use refs for values needed in window listeners to avoid stale closures
  const selStartRef = useRef<{ x: number; y: number } | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

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
          // Hit-test cards against the selection rect using direct px/py
          const hits = new Set<number>();
          const cx = window.innerWidth / 2;
          const cy = window.innerHeight / 2;
          const currentCards = cardsRef.current;
          const halfW = getCardWidth() / 2;
          const halfH = halfW * 0.7;

          currentCards.forEach((card) => {
            const cardCenterX = cx + card.px;
            const cardCenterY = cy + card.py;
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

  // changeSelectedZ is a no-op since Z-axis is removed
  const changeSelectedZ = useCallback(
    (_delta: number) => {
      // no-op: Z-axis removed
    },
    [],
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
        const halfW = getCardWidth() / 2;
        const halfH = halfW * 0.7;
        currentCards.forEach((card) => {
          const cardCenterX = cx + card.px;
          const cardCenterY = cy + card.py;
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

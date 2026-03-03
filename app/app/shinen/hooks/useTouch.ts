import { useEffect, useRef } from "react";
import type { ShinenCard } from "../lib/types";
import { shouldSkipPreventDefaultForOpenLink } from "../lib/openLinkGuards";

interface TouchState {
  mode: "none" | "card-drag" | "selection";
  startTouches: { x: number; y: number }[];
  cardId: number | null;
  origPX: number;
  origPY: number;
}

const INITIAL_STATE: TouchState = {
  mode: "none",
  startTouches: [],
  cardId: null,
  origPX: 0,
  origPY: 0,
};

/**
 * Unified touch handler for mobile.
 * - 1 finger on card → drag
 * - 1 finger on background → selection rect
 */
export function useTouch(
  rootRef: React.RefObject<HTMLDivElement | null>,
  cards: ShinenCard[],
  setCards: React.Dispatch<React.SetStateAction<ShinenCard[]>>,
  selected: Set<number>,
  hoveredId: number | null,
  setHoveredId: (id: number | null) => void,
  setLayoutIdx: (idx: number) => void,
  onSelectionStart: (x: number, y: number) => void,
  onSelectionMove: (x: number, y: number) => void,
  onSelectionEnd: (x: number, y: number) => void,
) {
  const stateRef = useRef<TouchState>({ ...INITIAL_STATE });
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const hoveredIdRef = useRef(hoveredId);
  hoveredIdRef.current = hoveredId;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const touches = e.touches;
      const state = stateRef.current;

      if (touches.length === 1 && state.mode === "none") {
        const touch = touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
        if (shouldSkipPreventDefaultForOpenLink({ target })) {
          return;
        }
        const cardEl = target?.closest("[data-shinen-card]") as HTMLElement | null;

        if (cardEl) {
          // 1 finger on card → drag
          e.preventDefault();
          const cardId = Number(cardEl.dataset.shinenCard);
          const card = cardsRef.current.find((c) => c.id === cardId);
          if (card) {
            stateRef.current = {
              ...INITIAL_STATE,
              mode: "card-drag",
              startTouches: [{ x: touch.clientX, y: touch.clientY }],
              cardId,
              origPX: card.px,
              origPY: card.py,
            };
            setHoveredId(cardId);
          }
        } else {
          // 1 finger on background → selection rect
          stateRef.current = {
            ...INITIAL_STATE,
            mode: "selection",
            startTouches: [{ x: touch.clientX, y: touch.clientY }],
          };
          onSelectionStart(touch.clientX, touch.clientY);
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const state = stateRef.current;
      const touches = e.touches;

      if (state.mode === "none") return;

      if (state.mode === "card-drag" && touches.length === 1) {
        e.preventDefault();
        const touch = touches[0];
        const dx = touch.clientX - state.startTouches[0].x;
        const dy = touch.clientY - state.startTouches[0].y;
        setCards((prev) =>
          prev.map((c) =>
            c.id === state.cardId
              ? { ...c, px: state.origPX + dx, py: state.origPY + dy }
              : c,
          ),
        );
        setLayoutIdx(-1);
        return;
      }

      if (state.mode === "selection" && touches.length === 1) {
        const touch = touches[0];
        onSelectionMove(touch.clientX, touch.clientY);
        return;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const state = stateRef.current;

      if (state.mode === "selection" && e.touches.length === 0) {
        const changed = e.changedTouches[0];
        onSelectionEnd(changed.clientX, changed.clientY);
      }

      if (state.mode === "card-drag") {
        setHoveredId(null);
      }

      if (e.touches.length === 0) {
        stateRef.current = { ...INITIAL_STATE };
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [rootRef, setCards, setHoveredId, setLayoutIdx, onSelectionStart, onSelectionMove, onSelectionEnd]);
}

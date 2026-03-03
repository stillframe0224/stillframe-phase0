import { useState, useEffect, useCallback, useRef } from "react";
import type { ShinenCard, DragState, GroupDragState } from "../lib/types";
import { shouldSkipPreventDefaultForOpenLink } from "../lib/openLinkGuards";

const INTERACTIVE_SELECTOR =
  "button, a, input, textarea, select, option, label, video, audio, iframe, [contenteditable='true'], [data-no-drag]";

export function useDrag(
  cards: ShinenCard[],
  setCards: React.Dispatch<React.SetStateAction<ShinenCard[]>>,
  selected: Set<number>,
  setLayoutIdx: (idx: number) => void,
) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [groupDrag, setGroupDrag] = useState<GroupDragState | null>(null);

  const captureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null);

  const releasePointerCaptureSafe = useCallback(() => {
    const capture = captureRef.current;
    if (!capture) return;
    captureRef.current = null;
    if (!capture.el.releasePointerCapture) return;
    try {
      if (capture.el.hasPointerCapture && !capture.el.hasPointerCapture(capture.pointerId)) return;
      capture.el.releasePointerCapture(capture.pointerId);
    } catch {
      // Ignore browsers that throw if capture was already released.
    }
  }, []);

  // Single card drag
  const startDrag = useCallback(
    (cardId: number, e: React.PointerEvent) => {
      if (e.shiftKey || e.button === 1 || e.button === 2) return;
      const target = e.target as HTMLElement | null;
      if (shouldSkipPreventDefaultForOpenLink({ target })) return;
      if (target?.closest(INTERACTIVE_SELECTOR)) return;
      e.preventDefault();
      e.stopPropagation(); // Prevent background handler from firing
      const el = e.currentTarget as HTMLElement | null;
      if (el?.setPointerCapture) {
        try {
          el.setPointerCapture(e.pointerId);
          captureRef.current = { el, pointerId: e.pointerId };
        } catch {
          // Ignore if browser denies capture for this pointer.
        }
      }

      // If card is in a multi-selection, start group drag
      if (selected.has(cardId) && selected.size > 1) {
        const origins = new Map<number, { px: number; py: number }>();
        cards.forEach((c) => {
          if (selected.has(c.id)) {
            origins.set(c.id, { px: c.px, py: c.py });
          }
        });
        setGroupDrag({ startMX: e.clientX, startMY: e.clientY, origins });
        setLayoutIdx(-1);
        return;
      }

      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      setDrag({ id: cardId, startMX: e.clientX, startMY: e.clientY, origPX: card.px, origPY: card.py });
      setLayoutIdx(-1);
    },
    [cards, selected, setLayoutIdx],
  );

  // Single drag pointermove/up
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      setCards((prev) =>
        prev.map((c) =>
          c.id === drag.id
            ? {
                ...c,
                px: drag.origPX + (e.clientX - drag.startMX),
                py: drag.origPY + (e.clientY - drag.startMY),
              }
            : c,
        ),
      );
    };
    const onUp = (e: PointerEvent) => {
      const capture = captureRef.current;
      if (capture && capture.pointerId !== e.pointerId) return;
      releasePointerCaptureSafe();
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      releasePointerCaptureSafe();
    };
  }, [drag, setCards, releasePointerCaptureSafe]);

  // Group drag pointermove/up
  useEffect(() => {
    if (!groupDrag) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - groupDrag.startMX;
      const dy = e.clientY - groupDrag.startMY;
      setCards((prev) =>
        prev.map((c) => {
          const orig = groupDrag.origins.get(c.id);
          if (!orig) return c;
          return { ...c, px: orig.px + dx, py: orig.py + dy };
        }),
      );
    };
    const onUp = (e: PointerEvent) => {
      const capture = captureRef.current;
      if (capture && capture.pointerId !== e.pointerId) return;
      releasePointerCaptureSafe();
      setGroupDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      releasePointerCaptureSafe();
    };
  }, [groupDrag, setCards, releasePointerCaptureSafe]);

  useEffect(() => () => releasePointerCaptureSafe(), [releasePointerCaptureSafe]);

  const isDragging = drag !== null || groupDrag !== null;

  return { drag, groupDrag, startDrag, isDragging };
}

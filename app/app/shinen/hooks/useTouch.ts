import { useEffect, useRef, useCallback, type MutableRefObject } from "react";
import { ZOOM_MIN, ZOOM_MAX, Z_MIN, Z_MAX } from "../lib/constants";
import type { CameraState, ShinenCard } from "../lib/types";
import { shouldSkipPreventDefaultForOpenLink } from "../lib/openLinkGuards";

interface TouchState {
  mode: "none" | "card-drag" | "selection" | "camera" | "pinch";
  startTouches: { x: number; y: number }[];
  cardId: number | null;
  origPX: number;
  origPY: number;
  origCamRx: number;
  origCamRy: number;
  origZoom: number;
  startDist: number;
}

const INITIAL_STATE: TouchState = {
  mode: "none",
  startTouches: [],
  cardId: null,
  origPX: 0,
  origPY: 0,
  origCamRx: 0,
  origCamRy: 0,
  origZoom: 0,
  startDist: 0,
};

function touchDist(t1: Touch, t2: Touch): number {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

function touchCenter(t1: Touch, t2: Touch): { x: number; y: number } {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}

/**
 * Unified touch handler for mobile.
 * - 1 finger on card → drag
 * - 1 finger on background → selection rect
 * - 2 fingers → camera rotation (drag) + pinch zoom
 */
export function useTouch(
  rootRef: React.RefObject<HTMLDivElement | null>,
  cards: ShinenCard[],
  setCards: React.Dispatch<React.SetStateAction<ShinenCard[]>>,
  targetCam: MutableRefObject<CameraState>,
  cam: CameraState,
  zoom: number,
  setZoom: (z: number | ((z: number) => number)) => void,
  selected: Set<number>,
  hoveredId: number | null,
  setHoveredId: (id: number | null) => void,
  setLayoutIdx: (idx: number) => void,
  onSelectionStart: (x: number, y: number) => void,
  onSelectionMove: (x: number, y: number) => void,
  onSelectionEnd: (x: number, y: number) => void,
  changeSelectedZ: (delta: number) => void,
) {
  const stateRef = useRef<TouchState>({ ...INITIAL_STATE });
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const camRef = useRef(cam);
  camRef.current = cam;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
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

      if (touches.length === 2) {
        // Upgrade to 2-finger mode — cancel any 1-finger operation
        e.preventDefault();
        const dist = touchDist(touches[0], touches[1]);
        const center = touchCenter(touches[0], touches[1]);
        stateRef.current = {
          ...INITIAL_STATE,
          mode: "pinch",
          startTouches: [
            { x: center.x, y: center.y },
          ],
          origCamRx: targetCam.current.rx,
          origCamRy: targetCam.current.ry,
          origZoom: zoomRef.current,
          startDist: dist,
          cardId: state.cardId, // keep cardId for z-depth pinch
        };
        return;
      }

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
        // Simple 1:1 drag for mobile (no projection compensation needed at default zoom)
        const invScale = 1;
        setCards((prev) =>
          prev.map((c) =>
            c.id === state.cardId
              ? { ...c, px: state.origPX + dx * invScale, py: state.origPY + dy * invScale }
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

      if (state.mode === "pinch" && touches.length === 2) {
        e.preventDefault();
        const dist = touchDist(touches[0], touches[1]);
        const center = touchCenter(touches[0], touches[1]);
        const startCenter = state.startTouches[0];

        // Camera rotation from 2-finger drag (center movement)
        const dx = center.x - startCenter.x;
        const dy = center.y - startCenter.y;
        targetCam.current = {
          rx: Math.max(-50, Math.min(50, state.origCamRx + dy * -0.35)),
          ry: Math.max(-60, Math.min(60, state.origCamRy + dx * 0.4)),
        };

        // Pinch zoom (or z-depth if card hovered)
        const scale = dist / state.startDist;
        const zoomDelta = (scale - 1) * 500;

        if (hoveredIdRef.current != null && selectedRef.current.has(hoveredIdRef.current) && selectedRef.current.size > 1) {
          // Pinch on selected group → z-depth
          changeSelectedZ(-zoomDelta * 0.5);
        } else if (hoveredIdRef.current != null) {
          // Pinch on single card → z-depth
          const hid = hoveredIdRef.current;
          setCards((prev) =>
            prev.map((c) =>
              c.id === hid ? { ...c, z: Math.max(Z_MIN, Math.min(Z_MAX, c.z + zoomDelta * 0.5)) } : c,
            ),
          );
          setLayoutIdx(-1);
        } else {
          // Background pinch → zoom
          setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.origZoom + zoomDelta)));
        }
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
  }, [rootRef, setCards, targetCam, setZoom, setHoveredId, setLayoutIdx, onSelectionStart, onSelectionMove, onSelectionEnd, changeSelectedZ]);
}

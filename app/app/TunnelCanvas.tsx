"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Card, File as FileRecord } from "@/lib/supabase/types";
import TunnelCardWrapper from "./TunnelCardWrapper";
import { useTunnelStore } from "./useTunnelStore";
import { createFSMContext, transition, type FSMContext } from "./tunnelDragFSM";
import { countOverlapPairs } from "./tunnelLayout";
import {
  createPerfMonitor,
  recordFrameTime,
  tierCssClass,
  isLowEndMobile,
  type PerfMonitor,
  type QualityTier,
} from "./tunnelPerfMonitor";

// ── Debug hook type ──
declare global {
  interface Window {
    __SHINEN_DEBUG__?: {
      overlapPairs: number;
      queuedReset: number;
      state: string;
      qualityTier: QualityTier;
    };
  }
}

interface TunnelCanvasProps {
  cards: Card[];
  onDelete: (id: string) => void;
  onPinToggle: (id: string, pinned: boolean) => void;
  onFileAssign: (cardId: string, fileId: string | null) => void;
  onUpdate: (cardId: string) => void;
  onNotesSaved: (cardId: string, notes: string | null) => void;
  files: FileRecord[];
  userId: string;
  toolsContent?: ReactNode;
  cardCount?: number;
}

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.001;
const ZOOM_COMMIT_DELAY = 250;
const DEFAULT_CAMERA = { x: 0, y: 0, zoom: 1 };
const DEFAULT_ORBIT = { rx: -8, ry: 10 };
const RESIZE_SETTLE_DEBOUNCE_MS = 80;

export default function TunnelCanvas({
  cards,
  onDelete,
  onPinToggle,
  onFileAssign,
  onUpdate,
  onNotesSaved,
  files,
  userId,
  toolsContent,
  cardCount,
}: TunnelCanvasProps) {
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const {
    positions,
    camera,
    persistError,
    setCardPosition,
    setCamera,
    arrangeCards,
    resetAll,
  } = useTunnelStore(userId, cardIds);

  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef(DEFAULT_ORBIT);
  const cameraRef = useRef(camera);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orbitState = useRef<{
    startX: number;
    startY: number;
    startRx: number;
    startRy: number;
    pointerId: number;
  } | null>(null);

  // FSM state
  const fsmRef = useRef<FSMContext>(createFSMContext());
  const cardSizesRef = useRef<Map<string, { w: number; h: number }>>(new Map());
  const settleRafRef = useRef<number | null>(null);
  const dirtySizeRef = useRef(false);
  const resizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Perf monitor
  const perfRef = useRef<PerfMonitor>(createPerfMonitor(isLowEndMobile() ? "no-shadow" : "full"));
  const perfRafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const [qualityTier, setQualityTier] = useState<QualityTier>(() =>
    isLowEndMobile() ? "no-shadow" : "full"
  );

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isCameraDirty, setIsCameraDirty] = useState(false);

  // ── Debug hook ──
  const updateDebug = useCallback(() => {
    if (typeof window !== "undefined") {
      const { overlapPairs } = countOverlapPairs(positions, cardSizesRef.current);
      window.__SHINEN_DEBUG__ = {
        overlapPairs,
        queuedReset: fsmRef.current.pendingReset ? 1 : 0,
        state: fsmRef.current.state,
        qualityTier: perfRef.current.tier,
      };
    }
  }, [positions]);

  useEffect(() => {
    updateDebug();
  }, [updateDebug]);

  const isDirty = useCallback(
    (cam: { x: number; y: number; zoom: number }, orbit: { rx: number; ry: number }) => {
      return (
        Math.abs(cam.x - DEFAULT_CAMERA.x) > 0.1 ||
        Math.abs(cam.y - DEFAULT_CAMERA.y) > 0.1 ||
        Math.abs(cam.zoom - DEFAULT_CAMERA.zoom) > 0.001 ||
        Math.abs(orbit.rx - DEFAULT_ORBIT.rx) > 0.1 ||
        Math.abs(orbit.ry - DEFAULT_ORBIT.ry) > 0.1
      );
    },
    []
  );

  const applyVisualCamera = useCallback(
    (cam: { x: number; y: number; zoom: number }, orbit: { rx: number; ry: number }) => {
      if (stageRef.current) {
        stageRef.current.style.transform =
          `translate(${cam.x}px, ${cam.y}px) rotateX(${orbit.rx}deg) rotateY(${orbit.ry}deg) scale(${cam.zoom})`;
      }
      if (sceneRef.current) {
        sceneRef.current.setAttribute("data-cam-rx", String(Number(orbit.rx.toFixed(3))));
        sceneRef.current.setAttribute("data-cam-ry", String(Number(orbit.ry.toFixed(3))));
        sceneRef.current.setAttribute("data-cam-zoom", String(Number(cam.zoom.toFixed(4))));
      }
      setIsCameraDirty(isDirty(cam, orbit));
    },
    [isDirty]
  );

  useEffect(() => {
    cameraRef.current = camera;
    applyVisualCamera(camera, orbitRef.current);
  }, [camera, applyVisualCamera]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) {
        clearTimeout(commitTimerRef.current);
      }
    };
  }, []);

  // ── Perf monitor rAF loop ──
  useEffect(() => {
    const tick = (now: number) => {
      if (lastFrameRef.current > 0) {
        const delta = now - lastFrameRef.current;
        perfRef.current = recordFrameTime(perfRef.current, delta);
        const newTier = perfRef.current.tier;
        setQualityTier((prev) => {
          if (prev !== newTier) {
            // Apply CSS class
            if (sceneRef.current) {
              sceneRef.current.classList.remove("perf-no-shadow", "perf-no-3d", "perf-no-anim");
              const cls = tierCssClass(newTier);
              if (cls) sceneRef.current.classList.add(cls);
            }
            return newTier;
          }
          return prev;
        });
      }
      lastFrameRef.current = now;
      perfRafRef.current = requestAnimationFrame(tick);
    };
    perfRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (perfRafRef.current !== null) {
        cancelAnimationFrame(perfRafRef.current);
      }
    };
  }, []);

  // ── FSM drag handlers ──

  const executeReset = useCallback(() => {
    resetAll(cardSizesRef.current.size > 0 ? cardSizesRef.current : undefined);
    orbitRef.current = DEFAULT_ORBIT;
    cameraRef.current = DEFAULT_CAMERA;
    applyVisualCamera(DEFAULT_CAMERA, DEFAULT_ORBIT);
  }, [resetAll, applyVisualCamera]);

  const handleDragStart = useCallback((cardId: string) => {
    fsmRef.current = transition(fsmRef.current, { type: "DRAG_START", cardId });
    // Cancel any pending settle
    if (settleRafRef.current !== null) {
      cancelAnimationFrame(settleRafRef.current);
      settleRafRef.current = null;
    }
    updateDebug();
  }, [updateDebug]);

  const handleDragEnd = useCallback((cardId: string) => {
    fsmRef.current = transition(fsmRef.current, { type: "DRAG_END", cardId });
    // 1-frame delay for settling
    settleRafRef.current = requestAnimationFrame(() => {
      const hadPending = fsmRef.current.pendingReset;
      fsmRef.current = transition(fsmRef.current, { type: "SETTLE_COMPLETE" });
      settleRafRef.current = null;

      if (hadPending) {
        executeReset();
        fsmRef.current = { ...fsmRef.current, pendingReset: false };
      }

      // If sizes changed during settling, debounce one re-layout
      if (dirtySizeRef.current && fsmRef.current.state === "idle") {
        dirtySizeRef.current = false;
        if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
        resizeDebounceRef.current = setTimeout(() => {
          if (fsmRef.current.state === "idle") {
            arrangeCards(cardSizesRef.current);
          }
        }, RESIZE_SETTLE_DEBOUNCE_MS);
      }

      updateDebug();
    });
    updateDebug();
  }, [executeReset, arrangeCards, updateDebug]);

  const handleResetRequest = useCallback(() => {
    if (fsmRef.current.state === "idle") {
      executeReset();
    } else {
      fsmRef.current = transition(fsmRef.current, { type: "RESET_REQUEST" });
    }
    updateDebug();
  }, [executeReset, updateDebug]);

  // ── ResizeObserver: dirtySize flag + rAF batching ──

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let resizeRafPending = false;

    const observer = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const cardId = el.getAttribute("data-card-id");
        if (!cardId) continue;
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w === 0 && h === 0) continue;
        const prev = cardSizesRef.current.get(cardId);
        if (!prev || Math.abs(prev.w - w) > 2 || Math.abs(prev.h - h) > 2) {
          cardSizesRef.current.set(cardId, { w, h });
          changed = true;
        }
      }

      if (!changed) return;
      dirtySizeRef.current = true;

      // During settling/dragging, just mark dirty — don't re-layout
      if (fsmRef.current.state !== "idle") return;

      // Batch in rAF (one per frame)
      if (!resizeRafPending) {
        resizeRafPending = true;
        requestAnimationFrame(() => {
          resizeRafPending = false;
          if (dirtySizeRef.current && fsmRef.current.state === "idle") {
            dirtySizeRef.current = false;
            arrangeCards(cardSizesRef.current);
          }
        });
      }
    });

    // Observe all .tunnel-card elements
    const observeAll = () => {
      const allCards = stage.querySelectorAll(".tunnel-card[data-card-id]");
      allCards.forEach((el) => observer.observe(el));
    };
    observeAll();

    // MutationObserver to catch new cards
    const mutation = new MutationObserver(observeAll);
    mutation.observe(stage, { childList: true });

    return () => {
      observer.disconnect();
      mutation.disconnect();
      if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
    };
  }, [arrangeCards]);

  // Cleanup settle RAF on unmount
  useEffect(() => {
    return () => {
      if (settleRafRef.current !== null) {
        cancelAnimationFrame(settleRafRef.current);
      }
    };
  }, []);

  const handleScenePointerDown = useCallback((e: React.PointerEvent) => {
    if (!e.shiftKey) return;
    const target = e.target as HTMLElement;
    if (target.closest(".tunnel-card") || target.closest(".tunnel-hud") || target.closest(".tunnel-tools-drawer")) return;

    orbitState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRx: orbitRef.current.rx,
      startRy: orbitRef.current.ry,
      pointerId: e.pointerId,
    };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleOrbitMove = (e: PointerEvent) => {
      const os = orbitState.current;
      if (!os || os.pointerId !== e.pointerId) return;

      const dx = e.clientX - os.startX;
      const dy = e.clientY - os.startY;
      const nextOrbit = {
        rx: Math.max(-45, Math.min(45, os.startRx - dy * 0.12)),
        ry: os.startRy + dx * 0.12,
      };
      orbitRef.current = nextOrbit;
      applyVisualCamera(cameraRef.current, nextOrbit);
    };

    const endOrbit = (e: PointerEvent) => {
      const os = orbitState.current;
      if (!os || os.pointerId !== e.pointerId) return;
      orbitState.current = null;
      applyVisualCamera(cameraRef.current, orbitRef.current);
    };

    window.addEventListener("pointermove", handleOrbitMove);
    window.addEventListener("pointerup", endOrbit);
    window.addEventListener("pointercancel", endOrbit);
    return () => {
      window.removeEventListener("pointermove", handleOrbitMove);
      window.removeEventListener("pointerup", endOrbit);
      window.removeEventListener("pointercancel", endOrbit);
    };
  }, [applyVisualCamera]);

  const handleSceneWheel = useCallback(
    (e: React.WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".tunnel-card") || target.closest(".tunnel-tools-drawer")) return;

      e.preventDefault();
      const newZoom = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, cameraRef.current.zoom - e.deltaY * ZOOM_STEP)
      );
      const next = { ...cameraRef.current, zoom: newZoom };

      cameraRef.current = next;
      applyVisualCamera(next, orbitRef.current);

      if (commitTimerRef.current !== null) {
        clearTimeout(commitTimerRef.current);
      }
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null;
        setCamera(cameraRef.current);
      }, ZOOM_COMMIT_DELAY);
    },
    [setCamera, applyVisualCamera]
  );

  const handleResetCamera = useCallback(() => {
    if (commitTimerRef.current !== null) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    orbitRef.current = DEFAULT_ORBIT;
    cameraRef.current = DEFAULT_CAMERA;
    setCamera(DEFAULT_CAMERA);
    applyVisualCamera(DEFAULT_CAMERA, DEFAULT_ORBIT);
  }, [setCamera, applyVisualCamera]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;

      if (e.key === "k" || e.key === "K") {
        setIsToolsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (isToolsOpen) {
          setIsToolsOpen(false);
        } else {
          handleResetRequest();
        }
      } else if (e.key === "r" || e.key === "R") {
        handleResetCamera();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isToolsOpen, handleResetCamera, handleResetRequest]);

  const tierClass = tierCssClass(qualityTier);

  return (
    <div
      ref={sceneRef}
      data-testid="tunnel-root"
      data-cam-rx={DEFAULT_ORBIT.rx}
      data-cam-ry={DEFAULT_ORBIT.ry}
      data-cam-zoom={DEFAULT_CAMERA.zoom}
      className={`tunnel-scene${tierClass ? ` ${tierClass}` : ""}`}
      onPointerDown={handleScenePointerDown}
      onWheel={handleSceneWheel}
    >
      <div className="tunnel-grid-bg" />
      <div
        ref={stageRef}
        className="tunnel-stage"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) rotateX(${DEFAULT_ORBIT.rx}deg) rotateY(${DEFAULT_ORBIT.ry}deg) scale(${camera.zoom})`,
        }}
      >
        {cards.map((card, i) => {
          const pos = positions[card.id] || { x: 100, y: 100, z: 0 };
          return (
            <TunnelCardWrapper
              key={card.id}
              card={card}
              index={i}
              position={pos}
              onPositionChange={setCardPosition}
              onDelete={onDelete}
              onPinToggle={onPinToggle}
              onFileAssign={onFileAssign}
              onUpdate={onUpdate}
              onNotesSaved={onNotesSaved}
              files={files}
              stageScale={camera.zoom}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          );
        })}
      </div>

      <div className="tunnel-hud" data-testid="tunnel-hud">
        <div className="tunnel-hud-left">
          <a href="/" className="tunnel-hud-brand" aria-label="Home">
            <img src="/enso.png" alt="" />
            SHINEN
          </a>
          <span className="tunnel-hud-dot" aria-hidden="true" />
          <span className="tunnel-hud-count">{cardCount ?? cards.length}</span>
          {persistError && (
            <span data-testid="tunnel-persist-error" className="tunnel-hud-error">
              {persistError === "quota" ? "not saved: quota" : "not saved: parse"}
            </span>
          )}
        </div>
        <div className="tunnel-hud-right">
          {isCameraDirty && (
            <button type="button" className="tunnel-hud-btn" onClick={handleResetCamera}>
              Reset
            </button>
          )}
          <button type="button" className="tunnel-hud-btn" onClick={() => setIsToolsOpen((prev) => !prev)}>
            ...
          </button>
        </div>
      </div>

      {isToolsOpen && (
        <aside className="tunnel-tools-drawer" data-testid="tools-drawer">
          <div className="tunnel-tools-head">
            <strong>Tools</strong>
            <button type="button" className="tunnel-hud-btn" onClick={() => setIsToolsOpen(false)}>
              Close
            </button>
          </div>
          {toolsContent}
        </aside>
      )}
    </div>
  );
}

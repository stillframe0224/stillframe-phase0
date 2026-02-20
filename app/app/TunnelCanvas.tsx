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
import { countOverlapPairs } from "./tunnelArrange";
import J7Logo from "@/app/components/J7Logo";

declare global {
  interface Window {
    __SHINEN_DEBUG__?: {
      requestArrange: () => void;
      requestResetAll: () => void;
      snapshot: () => {
        state: "idle" | "dragging" | "settling";
        overlapPairs: number;
        queuedReset?: boolean;
        queuedArrange?: boolean;
        arrangeVersion: number;
        layout: "grid" | "scatter" | "circle" | "cluster";
        camera: { x: number; y: number; zoom: number };
      };
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
  /** Called when user selects files via upload button or drag-and-drop onto canvas */
  onUpload?: (files: FileList) => void;
}

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.001;
const ZOOM_COMMIT_DELAY = 250;
const DEFAULT_CAMERA = { x: 0, y: 0, zoom: 1 };
const DEFAULT_ORBIT = { rx: -8, ry: 10 };

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
  onUpload,
}: TunnelCanvasProps) {
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const cardTypeMap = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.id, c.card_type || "memo"])),
    [cards]
  );
  const {
    positions,
    camera,
    layout,
    persistError,
    setCardPosition,
    setCamera,
    cycleLayout,
    arrangeCards,
    resetAll,
  } = useTunnelStore(userId, cardIds, cardTypeMap);

  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
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

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const isDraggingRef = useRef(false);
  const queuedResetRef = useRef(false);
  const queuedArrangeRef = useRef(false);
  const arrangeVersionRef = useRef(0);
  const interactionStateRef = useRef<"idle" | "dragging" | "settling">("idle");

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
        sceneRef.current.setAttribute("data-orbit-rx", String(Number(orbit.rx.toFixed(3))));
        sceneRef.current.setAttribute("data-orbit-ry", String(Number(orbit.ry.toFixed(3))));
      }
    },
    []
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

  const performResetAll = useCallback(() => {
    interactionStateRef.current = "settling";
    arrangeVersionRef.current += 1;
    queuedArrangeRef.current = false;
    if (commitTimerRef.current !== null) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    // resetAll() arranges GRID, centers positions, saves camera={0,0,1} — returns void
    resetAll();
    // Reset to flat view — orbit must always be horizontal.
    orbitRef.current = DEFAULT_ORBIT;
    cameraRef.current = DEFAULT_CAMERA;
    applyVisualCamera(DEFAULT_CAMERA, DEFAULT_ORBIT);
    requestAnimationFrame(() => {
      interactionStateRef.current = isDraggingRef.current ? "dragging" : "idle";
      if (queuedResetRef.current && !isDraggingRef.current) {
        queuedResetRef.current = false;
        performResetAll();
      }
    });
  }, [resetAll, applyVisualCamera]);

  const requestResetAll = useCallback(() => {
    if (isDraggingRef.current) {
      queuedResetRef.current = true;
      return;
    }
    performResetAll();
  }, [performResetAll]);

  const calcOverlapPairs = useCallback(() => {
    return countOverlapPairs(positions, { w: 240, h: 320 });
  }, [positions]);

  const requestArrange = useCallback(() => {
    if (isDraggingRef.current) {
      queuedArrangeRef.current = true;
      return;
    }
    arrangeVersionRef.current += 1;
    arrangeCards();
  }, [arrangeCards]);

  const onDragStateChange = useCallback((dragging: boolean) => {
    isDraggingRef.current = dragging;
    interactionStateRef.current = dragging ? "dragging" : "idle";
    if (!dragging) {
      if (queuedResetRef.current) {
        queuedResetRef.current = false;
        queuedArrangeRef.current = false;
        performResetAll();
        return;
      }
      if (queuedArrangeRef.current) {
        queuedArrangeRef.current = false;
        arrangeVersionRef.current += 1;
        arrangeCards();
      }
    }
  }, [arrangeCards, performResetAll]);

  useEffect(() => {
    const debugEnabled =
      typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_SHINEN_DEBUG === "1" &&
      new URLSearchParams(window.location.search).get("debug") === "1";

    if (!debugEnabled) {
      if (typeof window !== "undefined") {
        delete window.__SHINEN_DEBUG__;
      }
      return;
    }
    window.__SHINEN_DEBUG__ = {
      requestArrange,
      requestResetAll,
      snapshot: () => ({
        state: interactionStateRef.current,
        overlapPairs: calcOverlapPairs(),
        queuedArrange: queuedArrangeRef.current,
        queuedReset: queuedResetRef.current,
        arrangeVersion: arrangeVersionRef.current,
        layout: layout as "grid" | "scatter" | "circle" | "cluster",
        camera: { ...cameraRef.current },
      }),
    };
    return () => {
      delete window.__SHINEN_DEBUG__;
    };
  }, [requestArrange, requestResetAll, calcOverlapPairs, layout]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;

      if (e.key === "k" || e.key === "K") {
        setIsToolsOpen((prev) => !prev);
      } else if (e.key === "a" || e.key === "A") {
        requestArrange();
      } else if (e.key === "Escape") {
        if (isToolsOpen) {
          setIsToolsOpen(false);
        } else {
          requestResetAll();
        }
      } else if (e.key === "r" || e.key === "R") {
        requestResetAll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [requestArrange, requestResetAll, isToolsOpen]);

  return (
    <div
      ref={sceneRef}
      data-testid="tunnel-root"
      data-cam-rx={DEFAULT_ORBIT.rx}
      data-cam-ry={DEFAULT_ORBIT.ry}
      data-cam-zoom={DEFAULT_CAMERA.zoom}
      data-orbit-rx={DEFAULT_ORBIT.rx}
      data-orbit-ry={DEFAULT_ORBIT.ry}
      className="tunnel-scene"
      onPointerDown={handleScenePointerDown}
      onWheel={handleSceneWheel}
      onDragOver={onUpload ? (e) => e.preventDefault() : undefined}
      onDrop={onUpload ? (e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) onUpload(e.dataTransfer.files);
      } : undefined}
    >
      <div className="tunnel-grid-bg" data-testid="paper-grid" />
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
              onDragStateChange={onDragStateChange}
            />
          );
        })}
      </div>

      <div className="tunnel-hud" data-testid="tunnel-hud">
        <div className="tunnel-hud-left">
          <a href="/" className="tunnel-hud-brand" aria-label="Home">
            <J7Logo size={26} showText={true} dataTestId="j7-logo" />
          </a>
          <span className="tunnel-hud-dot" aria-hidden="true" />
          <span className="tunnel-hud-count">{cardCount ?? cards.length}</span>
          <button
            type="button"
            className="tunnel-hud-layout"
            data-testid="layout-pill"
            onClick={cycleLayout}
            title="Click to cycle layout"
          >
            {layout}
          </button>
          {persistError && (
            <span data-testid="tunnel-persist-error" className="tunnel-hud-error">
              {persistError === "quota" ? "not saved: quota" : "not saved: parse"}
            </span>
          )}
        </div>
        <div className="tunnel-hud-right">
          {onUpload && (
            <>
              <button
                type="button"
                className="tunnel-hud-btn tunnel-hud-btn--upload"
                data-testid="upload-btn"
                onClick={() => uploadInputRef.current?.click()}
                title="Upload image or video"
              >
                ↑ Upload
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*,video/*"
                multiple={false}
                data-testid="upload-input"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.length) {
                    onUpload(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
            </>
          )}
          <button
            type="button"
            className="tunnel-hud-btn"
            data-testid="arrange-btn"
            onClick={requestArrange}
          >
            Arrange
          </button>
          <button
            type="button"
            className="tunnel-hud-btn"
            data-testid="reset-btn"
            onClick={requestResetAll}
          >
            Reset
          </button>
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

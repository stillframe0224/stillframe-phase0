"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import type { Card, File as FileRecord } from "@/lib/supabase/types";
import { DndContext } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import TunnelCardWrapper from "./TunnelCardWrapper";
import { useTunnelStore } from "./useTunnelStore";

interface TunnelCanvasProps {
  cards: Card[];
  onDelete: (id: string) => void;
  onPinToggle: (id: string, pinned: boolean) => void;
  onFileAssign: (cardId: string, fileId: string | null) => void;
  onUpdate: (cardId: string) => void;
  onNotesSaved: (cardId: string, notes: string | null) => void;
  files: FileRecord[];
  userId: string;
}

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.001;
const ZOOM_COMMIT_DELAY = 250; // ms — debounce before writing to store

export default function TunnelCanvas({
  cards,
  onDelete,
  onPinToggle,
  onFileAssign,
  onUpdate,
  onNotesSaved,
  files,
  userId,
}: TunnelCanvasProps) {
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const {
    positions,
    camera,
    layout,
    setCardPosition,
    setCamera,
    cycleLayout,
    resetAll,
  } = useTunnelStore(userId, cardIds);

  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{
    startX: number;
    startY: number;
    startCamX: number;
    startCamY: number;
    pointerId: number;
  } | null>(null);

  // Refs for debounced zoom — avoids setCamera on every wheel tick
  const cameraRef = useRef(camera);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep cameraRef in sync with store camera (pan commits, resetAll, etc.)
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) {
        clearTimeout(commitTimerRef.current);
      }
    };
  }, []);

  // Camera pan (shift+drag on scene)
  const handleScenePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!e.shiftKey) return;
      // Only on the scene/stage background, not on cards
      const target = e.target as HTMLElement;
      if (target.closest(".tunnel-card")) return;

      panState.current = {
        startX: e.clientX,
        startY: e.clientY,
        startCamX: cameraRef.current.x,
        startCamY: cameraRef.current.y,
        pointerId: e.pointerId,
      };
      e.preventDefault();
    },
    [] // no camera dependency — reads from cameraRef
  );

  useEffect(() => {
    const handlePanMove = (e: PointerEvent) => {
      const ps = panState.current;
      if (!ps || ps.pointerId !== e.pointerId) return;

      const dx = e.clientX - ps.startX;
      const dy = e.clientY - ps.startY;
      // Direct DOM update for instant response
      if (stageRef.current) {
        stageRef.current.style.transform = `translate(${ps.startCamX + dx}px, ${ps.startCamY + dy}px) scale(${cameraRef.current.zoom})`;
      }
    };

    const handlePanUp = (e: PointerEvent) => {
      const ps = panState.current;
      if (!ps || ps.pointerId !== e.pointerId) return;

      const dx = e.clientX - ps.startX;
      const dy = e.clientY - ps.startY;
      const next = { x: ps.startCamX + dx, y: ps.startCamY + dy, zoom: cameraRef.current.zoom };
      cameraRef.current = next;
      setCamera(next);
      panState.current = null;
    };

    window.addEventListener("pointermove", handlePanMove);
    window.addEventListener("pointerup", handlePanUp);
    return () => {
      window.removeEventListener("pointermove", handlePanMove);
      window.removeEventListener("pointerup", handlePanUp);
    };
  }, [setCamera]); // removed camera.zoom dependency — reads from cameraRef

  // Scene-level scroll = zoom
  // Performance: DOM transform is updated immediately; setCamera is debounced
  // so React does NOT re-render on every wheel tick during continuous scroll.
  const handleSceneWheel = useCallback(
    (e: React.WheelEvent) => {
      // If the event originated from a card, let card handle it (z-depth)
      const target = e.target as HTMLElement;
      if (target.closest(".tunnel-card")) return;

      e.preventDefault();

      // Compute next zoom from current ref (not stale state)
      const newZoom = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, cameraRef.current.zoom - e.deltaY * ZOOM_STEP)
      );
      const next = { ...cameraRef.current, zoom: newZoom };

      // 1) Update ref immediately (no re-render)
      cameraRef.current = next;

      // 2) Update DOM transform immediately (frame-accurate, no React cycle)
      if (stageRef.current) {
        stageRef.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.zoom})`;
      }

      // 3) Debounce the store commit so React re-renders only after scroll settles
      if (commitTimerRef.current !== null) {
        clearTimeout(commitTimerRef.current);
      }
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null;
        setCamera(cameraRef.current);
      }, ZOOM_COMMIT_DELAY);
    },
    [setCamera] // stable — no camera state dependency
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;

      if (e.key === "a" || e.key === "A") {
        cycleLayout();
      } else if (e.key === "r" || e.key === "Escape") {
        resetAll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleLayout, resetAll]);

  return (
    <DndContext>
      <SortableContext items={[]} strategy={verticalListSortingStrategy}>
        <div
          ref={sceneRef}
          className="tunnel-scene"
          onPointerDown={handleScenePointerDown}
          onWheel={handleSceneWheel}
        >
          <div className="tunnel-grid-bg" />
          <div
            ref={stageRef}
            className="tunnel-stage"
            style={{
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
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
                />
              );
            })}
          </div>
          <div className="tunnel-hud">
            <div className="tunnel-hud-layout">{layout}</div>
            <div>A: layout / R: reset</div>
            <div>Shift+drag: pan / Scroll: zoom</div>
            <div>Scroll on card: depth</div>
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
}

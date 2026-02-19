"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import type { Card, File as FileRecord } from "@/lib/supabase/types";
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
        startCamX: camera.x,
        startCamY: camera.y,
        pointerId: e.pointerId,
      };
      e.preventDefault();
    },
    [camera.x, camera.y]
  );

  useEffect(() => {
    const handlePanMove = (e: PointerEvent) => {
      const ps = panState.current;
      if (!ps || ps.pointerId !== e.pointerId) return;

      const dx = e.clientX - ps.startX;
      const dy = e.clientY - ps.startY;
      // Direct DOM update for instant response
      if (stageRef.current) {
        stageRef.current.style.transform = `translate(${ps.startCamX + dx}px, ${ps.startCamY + dy}px) scale(${camera.zoom})`;
      }
    };

    const handlePanUp = (e: PointerEvent) => {
      const ps = panState.current;
      if (!ps || ps.pointerId !== e.pointerId) return;

      const dx = e.clientX - ps.startX;
      const dy = e.clientY - ps.startY;
      setCamera({ x: ps.startCamX + dx, y: ps.startCamY + dy, zoom: camera.zoom });
      panState.current = null;
    };

    window.addEventListener("pointermove", handlePanMove);
    window.addEventListener("pointerup", handlePanUp);
    return () => {
      window.removeEventListener("pointermove", handlePanMove);
      window.removeEventListener("pointerup", handlePanUp);
    };
  }, [camera.zoom, setCamera]);

  // Scene-level scroll = zoom
  const handleSceneWheel = useCallback(
    (e: React.WheelEvent) => {
      // If the event originated from a card, let card handle it (z-depth)
      const target = e.target as HTMLElement;
      if (target.closest(".tunnel-card")) return;

      e.preventDefault();
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.zoom - e.deltaY * ZOOM_STEP));
      setCamera({ ...camera, zoom: newZoom });
    },
    [camera, setCamera]
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
  );
}

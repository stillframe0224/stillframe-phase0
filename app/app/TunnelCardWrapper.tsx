"use client";

import { useRef, useCallback, useEffect } from "react";
import type { Card, File as FileRecord } from "@/lib/supabase/types";
import type { Position3D } from "./useTunnelStore";
import AppCard from "./AppCard";
import { getCardType } from "@/lib/cardTypes";

const INTERACTIVE_SELECTOR =
  'button,a,input,textarea,select,[role="button"],[data-no-drag],[data-no-dnd]';
const DRAG_THRESHOLD = 5;

interface TunnelCardWrapperProps {
  card: Card;
  index: number;
  position: Position3D;
  onPositionChange: (cardId: string, pos: Position3D) => void;
  onDelete: (id: string) => void;
  onPinToggle: (id: string, pinned: boolean) => void;
  onFileAssign: (cardId: string, fileId: string | null) => void;
  onUpdate: (cardId: string) => void;
  onNotesSaved: (cardId: string, notes: string | null) => void;
  files: FileRecord[];
  stageScale: number;
  onDragStateChange?: (dragging: boolean) => void;
}

export default function TunnelCardWrapper({
  card,
  index,
  position,
  onPositionChange,
  onDelete,
  onPinToggle,
  onFileAssign,
  onUpdate,
  onNotesSaved,
  files,
  stageScale,
  onDragStateChange,
}: TunnelCardWrapperProps) {
  const ct = getCardType(card.card_type || "memo");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    isDragging: boolean;
    pointerId: number;
  } | null>(null);
  const zDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Don't intercept interactive elements
      const target = e.target as HTMLElement;
      if (target.closest(INTERACTIVE_SELECTOR)) return;

      // Only primary button
      if (e.button !== 0) return;

      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: position.x,
        startPosY: position.y,
        isDragging: false,
        pointerId: e.pointerId,
      };
    },
    [position.x, position.y]
  );

  useEffect(() => {
    const finishDrag = (e: PointerEvent, commitPosition: boolean) => {
      const ds = dragState.current;
      if (!ds || ds.pointerId !== e.pointerId) return;

      if (ds.isDragging) {
        wrapperRef.current?.classList.remove("dragging");
        onDragStateChange?.(false);
      }

      if (commitPosition && ds.isDragging) {
        const dx = e.clientX - ds.startX;
        const dy = e.clientY - ds.startY;
        const finalX = ds.startPosX + dx / stageScale;
        const finalY = ds.startPosY + dy / stageScale;
        onPositionChange(card.id, { x: finalX, y: finalY, z: position.z });
      }

      const el = wrapperRef.current;
      if (el && el.hasPointerCapture(ds.pointerId)) {
        try {
          el.releasePointerCapture(ds.pointerId);
        } catch {
          // no-op
        }
      }

      dragState.current = null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const ds = dragState.current;
      if (!ds || ds.pointerId !== e.pointerId) return;

      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;

      if (!ds.isDragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        ds.isDragging = true;
        wrapperRef.current?.classList.add("dragging");
        onDragStateChange?.(true);
      }

      // Direct DOM manipulation for instant response, accounting for stage scale
      const newX = ds.startPosX + dx / stageScale;
      const newY = ds.startPosY + dy / stageScale;
      if (wrapperRef.current) {
        wrapperRef.current.style.transform = `translate3d(${newX}px, ${newY}px, ${position.z}px)`;
        wrapperRef.current.setAttribute("data-x", String(Number(newX.toFixed(2))));
        wrapperRef.current.setAttribute("data-y", String(Number(newY.toFixed(2))));
      }
    };

    const handlePointerUp = (e: PointerEvent) => finishDrag(e, true);
    const handlePointerCancel = (e: PointerEvent) => finishDrag(e, false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [card.id, position.z, stageScale, onPositionChange, onDragStateChange]);

  // Cleanup z-depth debounce timer on unmount
  useEffect(() => {
    return () => {
      if (zDebounce.current) clearTimeout(zDebounce.current);
    };
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.stopPropagation();
      const newZ = Math.max(-200, Math.min(200, position.z - e.deltaY * 0.5));
      // Direct DOM update
      if (wrapperRef.current) {
        wrapperRef.current.style.transform = `translate3d(${position.x}px, ${position.y}px, ${newZ}px)`;
      }
      // Debounced commit
      if (zDebounce.current) clearTimeout(zDebounce.current);
      zDebounce.current = setTimeout(() => {
        onPositionChange(card.id, { x: position.x, y: position.y, z: newZ });
      }, 300);
    },
    [card.id, position, onPositionChange]
  );

  return (
    <div
      ref={wrapperRef}
      className="tunnel-card"
      data-testid="tunnel-card"
      data-x={position.x}
      data-y={position.y}
      data-w={240}
      data-h={320}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, ${position.z}px)`,
        width: 240,
        ["--accent-rgb" as string]: ct.accentRgb,
      }}
      onPointerDown={handlePointerDown}
      onWheel={handleWheel}
    >
      <div className="tunnel-card-inner">
        <AppCard
          card={card}
          index={index}
          onDelete={onDelete}
          onPinToggle={onPinToggle}
          onFileAssign={onFileAssign}
          onUpdate={onUpdate}
          onNotesSaved={onNotesSaved}
          files={files}
          isDraggable={false}
        />
      </div>
    </div>
  );
}

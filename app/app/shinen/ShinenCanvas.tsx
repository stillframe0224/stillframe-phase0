"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { TYPES, LAYOUTS, Z_MIN, Z_MAX, INITIAL_CARDS } from "./lib/constants";
import { proj } from "./lib/projection";
import { applyLayout } from "./lib/layouts";
import type { ShinenCard } from "./lib/types";
import { useAnimationLoop } from "./hooks/useAnimationLoop";
import { useCamera } from "./hooks/useCamera";
import { useDrag } from "./hooks/useDrag";
import { useSelection } from "./hooks/useSelection";
import { useTouch } from "./hooks/useTouch";
import Background from "./Background";
import ThoughtCard from "./ThoughtCard";
import SelectionOverlay from "./SelectionOverlay";
import InputBar from "./InputBar";
import NavBar from "./NavBar";
import HintOverlay from "./HintOverlay";

interface ShinenCanvasProps {
  initialCards?: ShinenCard[];
  e2eMode?: boolean;
}

export default function ShinenCanvas({ initialCards, e2eMode = false }: ShinenCanvasProps) {
  const [cards, setCards] = useState<ShinenCard[]>(
    () => (initialCards ?? INITIAL_CARDS.map((c) => ({ ...c }))) as ShinenCard[],
  );
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [layoutIdx, setLayoutIdx] = useState(-1);
  const [sortDir, setSortDir] = useState<"newest" | "oldest">("newest");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Animation loop (rAF + camera lerp)
  const { cam, targetCam, time, resetCamera } = useAnimationLoop(e2eMode);

  // Camera rotation + zoom
  const { zoom, camDrag, startCamDrag, handleBgWheel, setZoom } = useCamera(targetCam);

  // Selection
  const {
    selected, selRect, startSelection, clearSelection, deleteSelected, changeSelectedZ, setSelected,
    startSelectionAt, moveSelectionTo, endSelectionAt,
  } = useSelection(cards, setCards, cam, zoom);

  // Drag (single + group)
  const { drag, groupDrag, startDrag, isDragging } = useDrag(cards, setCards, selected, setLayoutIdx, cam, zoom);

  // Touch gestures (mobile)
  useTouch(
    rootRef, cards, setCards, targetCam, cam, zoom, setZoom,
    selected, hoveredId, setHoveredId, setLayoutIdx,
    startSelectionAt, moveSelectionTo, endSelectionAt, changeSelectedZ,
  );

  // Wheel handler: card z-depth or background zoom
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (hoveredId != null) {
        if (selected.has(hoveredId) && selected.size > 1) {
          changeSelectedZ(e.deltaY);
        } else {
          setCards((prev) =>
            prev.map((c) =>
              c.id === hoveredId ? { ...c, z: Math.max(Z_MIN, Math.min(Z_MAX, c.z - e.deltaY * 0.8)) } : c,
            ),
          );
        }
        setLayoutIdx(-1);
      } else {
        handleBgWheel(e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [hoveredId, selected, changeSelectedZ, handleBgWheel]);

  // Keyboard shortcuts
  const cycleLayout = useCallback(() => {
    const next = (layoutIdx + 1) % LAYOUTS.length;
    setLayoutIdx(next);
    setCards((prev) => applyLayout(LAYOUTS[next], prev));
  }, [layoutIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "a" || e.key === "A") cycleLayout();
      if (e.key === "r" || e.key === "R") {
        resetCamera();
        setZoom(0);
      }
      if (e.key === "Escape") {
        if (playingId != null) {
          setPlayingId(null);
          return;
        }
        resetCamera();
        setZoom(0);
        clearSelection();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected.size > 0 && (e.target as HTMLElement).tagName !== "INPUT") {
          deleteSelected();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycleLayout, resetCamera, setZoom, clearSelection, deleteSelected, selected, playingId]);

  // Pointer down on background: selection rect or camera drag (also stops media)
  const handleBgDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-shinen-card]")) return;

      // Close playing media on background click
      if (playingId != null) {
        setPlayingId(null);
        return;
      }

      if (e.shiftKey || e.button === 1 || e.button === 2) {
        startCamDrag(e);
      } else {
        startSelection(e);
      }
    },
    [startCamDrag, startSelection, playingId],
  );

  // Add new thought (text only)
  const addThought = useCallback((text: string) => {
    setCards((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: Math.floor(Math.random() * 8),
        text,
        px: (Math.random() - 0.5) * 380,
        py: (Math.random() - 0.5) * 200,
        z: -20 - Math.random() * 100,
      },
    ]);
    setLayoutIdx(-1);
  }, []);

  // File upload handler
  const handleFileUpload = useCallback(
    (result: {
      text: string;
      type: number;
      media?: { type: "image" | "video" | "audio" | "pdf"; url: string; thumbnail?: string };
      file?: { name: string; size: number; mimeType: string };
    }) => {
      setCards((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: result.type,
          text: result.text,
          px: (Math.random() - 0.5) * 380,
          py: (Math.random() - 0.5) * 200,
          z: -20 - Math.random() * 100,
          media: result.media,
          file: result.file,
        },
      ]);
      setLayoutIdx(-1);
    },
    [],
  );

  // Media click handler — toggle playback (single active at a time)
  const handleMediaClick = useCallback(
    (cardId: number) => {
      setPlayingId((prev) => (prev === cardId ? null : cardId));
    },
    [],
  );

  // Project and z-sort cards
  const projCards = useMemo(
    () =>
      cards
        .map((card) => ({ card, p: proj(card.px, card.py, card.z + zoom, cam.rx, cam.ry) }))
        .sort((a, b) => a.p.z2 - b.p.z2),
    [cards, cam.rx, cam.ry, zoom],
  );

  const camIsRotated = Math.abs(cam.rx) > 0.5 || Math.abs(cam.ry) > 0.5 || Math.abs(zoom) > 5;

  const handleResetAll = useCallback(() => {
    resetCamera();
    setZoom(0);
  }, [resetCamera, setZoom]);

  const layoutLabel = layoutIdx >= 0 ? LAYOUTS[layoutIdx] : "free";
  const isIdle = !isDragging && hoveredId == null && !camDrag;

  return (
    <div
      ref={rootRef}
      data-testid="shinen-root"
      onPointerDown={handleBgDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        background: "#fdfdfd",
        fontFamily: "'DM Sans',sans-serif",
        touchAction: "none",
      }}
    >
      {/* Background (grid + sand) */}
      <Background cam={cam} zoom={zoom} time={time} />

      {/* Cards */}
      <div style={{ position: "absolute", inset: 0, zIndex: 5 }}>
        {projCards.map(({ card, p }) => (
          <ThoughtCard
            key={card.id}
            card={card}
            p={p}
            camRx={cam.rx}
            camRy={cam.ry}
            isDragging={drag?.id === card.id || (groupDrag != null && selected.has(card.id))}
            isHovered={hoveredId === card.id}
            isSelected={selected.has(card.id)}
            isPlaying={playingId === card.id}
            time={time}
            onPointerDown={(e) => startDrag(card.id, e)}
            onEnter={() => !isDragging && setHoveredId(card.id)}
            onLeave={() => !isDragging && setHoveredId(null)}
            onMediaClick={() => handleMediaClick(card.id)}
          />
        ))}
      </div>

      {/* Selection overlay */}
      <SelectionOverlay
        selRect={selRect}
        selectedCount={selected.size}
        onDelete={deleteSelected}
        onClear={clearSelection}
      />

      {/* Nav bar */}
      <NavBar
        cards={cards}
        layoutLabel={layoutLabel}
        camIsRotated={camIsRotated}
        onCycleLayout={cycleLayout}
        onResetCamera={handleResetAll}
      />

      {/* Hint */}
      <HintOverlay isIdle={isIdle} />

      {/* Input bar */}
      <InputBar onSubmit={addThought} onFileUpload={handleFileUpload} time={time} />
    </div>
  );
}

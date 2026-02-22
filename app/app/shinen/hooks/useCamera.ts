import { useState, useEffect, useCallback, type MutableRefObject } from "react";
import { ZOOM_MIN, ZOOM_MAX } from "../lib/constants";
import type { CamDragState, CameraState } from "../lib/types";

export function useCamera(targetCam: MutableRefObject<CameraState>) {
  const [zoom, setZoom] = useState(0);
  const [camDrag, setCamDrag] = useState<CamDragState | null>(null);

  const startCamDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setCamDrag({
        startMX: e.clientX,
        startMY: e.clientY,
        origRx: targetCam.current.rx,
        origRy: targetCam.current.ry,
      });
    },
    [targetCam],
  );

  const handleCamMove = useCallback(
    (e: MouseEvent | PointerEvent) => {
      if (!camDrag) return;
      const dx = e.clientX - camDrag.startMX;
      const dy = e.clientY - camDrag.startMY;
      targetCam.current = {
        rx: Math.max(-50, Math.min(50, camDrag.origRx + dy * -0.35)),
        ry: Math.max(-60, Math.min(60, camDrag.origRy + dx * 0.4)),
      };
    },
    [camDrag, targetCam],
  );

  useEffect(() => {
    if (!camDrag) return;
    const onMove = (e: PointerEvent) => handleCamMove(e);
    const onUp = () => setCamDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [camDrag, handleCamMove]);

  const handleBgWheel = useCallback((delta: number) => {
    setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z - delta * 0.8)));
  }, []);

  return { zoom, camDrag, startCamDrag, handleBgWheel, setZoom };
}

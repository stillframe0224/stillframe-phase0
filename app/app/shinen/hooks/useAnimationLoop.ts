import { useEffect, useRef, useState, useCallback } from "react";
import type { CameraState } from "../lib/types";

const LERP = 0.09;

export function useAnimationLoop(e2eMode: boolean) {
  const camRef = useRef<CameraState>({ rx: 0, ry: 0 });
  const targetCamRef = useRef<CameraState>({ rx: 0, ry: 0 });
  const timeRef = useRef(Date.now());
  const [, tick] = useState(0);

  useEffect(() => {
    if (e2eMode) return;
    let on = true;
    const loop = () => {
      if (!on) return;
      timeRef.current = Date.now();
      const c = camRef.current;
      const t = targetCamRef.current;
      c.rx += (t.rx - c.rx) * LERP;
      c.ry += (t.ry - c.ry) * LERP;
      tick((n) => n + 1);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { on = false; };
  }, [e2eMode]);

  const resetCamera = useCallback(() => {
    targetCamRef.current = { rx: 0, ry: 0 };
  }, []);

  return {
    cam: camRef.current,
    targetCam: targetCamRef,
    time: timeRef.current,
    resetCamera,
  };
}

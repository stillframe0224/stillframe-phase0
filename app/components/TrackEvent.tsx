"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/track";

interface TrackEventProps {
  event: string;
  props?: Record<string, string>;
}

export default function TrackEvent({ event, props }: TrackEventProps) {
  const tracked = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || tracked.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !tracked.current) {
          tracked.current = true;
          track(event, props);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [event, props]);

  return <div ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />;
}

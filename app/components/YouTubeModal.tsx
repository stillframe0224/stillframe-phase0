"use client";

import { useEffect, useCallback } from "react";

/**
 * Extract YouTube video ID from various URL formats.
 * Supports: watch?v=, youtu.be/, shorts/, live/, embed/, v/
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "").replace("m.", "");

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (!host.includes("youtube.com")) return null;

    // youtube.com/watch?v=<id>
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;

    // youtube.com/shorts/<id> | /live/<id> | /embed/<id> | /v/<id>
    const pathMatch = u.pathname.match(
      /^\/(shorts|live|embed|v)\/([\w-]{11})/
    );
    if (pathMatch) return pathMatch[2];

    return null;
  } catch {
    return null;
  }
}

interface YouTubeModalProps {
  videoId: string;
  onClose: () => void;
}

export default function YouTubeModal({ videoId, onClose }: YouTubeModalProps) {
  // ESC to close
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    // Prevent body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [handleKey]);

  // Render inline with fixed positioning (acts like a portal without react-dom import)
  return (
    <div
      className="yt-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="YouTube video player"
    >
      <div className="yt-modal-content">
        <button
          className="yt-modal-close"
          onClick={onClose}
          aria-label="Close video"
        >
          ×
        </button>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          title="YouTube video player"
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";

/**
 * AiFeedbackBus — Always-mounted global AI feedback handler
 *
 * Ensures:
 * - data-testid="ai-feedback-global" exists in DOM at all times (hidden when empty)
 * - window.__SHINEN_AI_FEEDBACK_READY flag set on mount
 * - Listens on both window AND document for 'shinen:ai-feedback' CustomEvents
 * - Auto-dismisses messages after 5 seconds
 *
 * This component is mounted once at the app root and never unmounts.
 */

declare global {
  interface Window {
    __SHINEN_AI_FEEDBACK_READY?: boolean;
  }
}

export default function AiFeedbackBus() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Set readiness flag
    window.__SHINEN_AI_FEEDBACK_READY = true;

    // Event handler for CustomEvent
    const handler = (e: Event) => {
      const detail = String((e as CustomEvent).detail || "");
      if (!detail) return;

      setMessage(detail);

      // Clear existing timer
      if (timerRef.current) clearTimeout(timerRef.current);

      // Auto-dismiss after 5 seconds
      timerRef.current = setTimeout(() => setMessage(null), 5000);
    };

    // Listen on both window AND document for safety
    window.addEventListener("shinen:ai-feedback", handler);
    document.addEventListener("shinen:ai-feedback", handler);

    return () => {
      window.removeEventListener("shinen:ai-feedback", handler);
      document.removeEventListener("shinen:ai-feedback", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      {/* Readiness marker — always in DOM, invisible */}
      <div data-testid="ai-feedback-bus-mounted" style={{ display: "none" }} />

      {/* Global feedback band — always in DOM, hidden when no message */}
      <div
        data-testid="ai-feedback-global"
        role="alert"
        aria-live="polite"
        hidden={!message}
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 20px",
          borderRadius: 8,
          background: "#7B4FD9",
          color: "#fff",
          fontSize: 13,
          fontFamily: "var(--font-dm)",
          zIndex: 99999,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          maxWidth: "90vw",
          wordBreak: "break-word",
          display: message ? "flex" : "none",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span>AI: {message}</span>
        <button
          onClick={() => setMessage(null)}
          style={{
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: 18,
            cursor: "pointer",
            padding: "0 4px",
            lineHeight: 1,
            fontWeight: 600,
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </>
  );
}

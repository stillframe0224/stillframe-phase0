"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    __SHINEN_AI_FEEDBACK_READY?: boolean;
  }
}

const AUTO_HIDE_MS = 5000;

function normalizeMessage(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }

    try {
      return JSON.stringify(detail);
    } catch {
      return "[object]";
    }
  }

  if (detail == null) {
    return "";
  }

  return String(detail);
}

export default function AiFeedbackBus() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const msg = normalizeMessage((event as CustomEvent).detail).trim();
      if (!msg) return;

      setMessage(msg);
      setVisible(true);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setVisible(false);
      }, AUTO_HIDE_MS);
    };

    window.addEventListener("shinen:ai-feedback", handler);
    window.__SHINEN_AI_FEEDBACK_READY = true;

    return () => {
      window.removeEventListener("shinen:ai-feedback", handler);
      window.__SHINEN_AI_FEEDBACK_READY = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <>
      <div data-testid="ai-feedback-bus-mounted" style={{ display: "none" }} />

      <div
        data-testid="ai-feedback-global"
        role="alert"
        aria-live="polite"
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
          display: visible ? "flex" : "none",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span>{message}</span>
        <button
          onClick={() => setVisible(false)}
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

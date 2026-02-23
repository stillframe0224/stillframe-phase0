import { useState, useEffect, useRef } from "react";
import { TAP_TARGET_MIN } from "./lib/constants";

interface MemoModalProps {
  cardId: number;
  initialText: string;
  onSave: (cardId: number, text: string) => void;
  onClose: () => void;
}

export default function MemoModal({ cardId, initialText, onSave, onClose }: MemoModalProps) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      data-testid="memo-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.15)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        role="dialog"
        aria-label="Edit memo"
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1.5px solid rgba(0,0,0,0.12)",
          padding: "20px 22px 16px",
          width: "min(400px, 88vw)",
          maxHeight: "min(360px, 80vh)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "0 16px 48px -12px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontFamily: "'DM Sans',sans-serif",
            color: "rgba(0,0,0,0.3)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 500,
          }}
        >
          memo
        </div>
        <textarea
          ref={textareaRef}
          data-testid="memo-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note..."
          style={{
            flex: 1,
            minHeight: 120,
            maxHeight: "50vh",
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.1)",
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 14,
            lineHeight: 1.7,
            color: "#111",
            resize: "vertical",
            outline: "none",
            background: "rgba(0,0,0,0.015)",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              minHeight: TAP_TARGET_MIN,
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "transparent",
              color: "rgba(0,0,0,0.35)",
              fontSize: 11,
              fontFamily: "'DM Sans',sans-serif",
              cursor: "pointer",
            }}
          >
            cancel
          </button>
          <button
            data-testid="memo-save"
            onClick={() => {
              onSave(cardId, text);
              onClose();
            }}
            style={{
              padding: "6px 14px",
              minHeight: TAP_TARGET_MIN,
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "rgba(0,0,0,0.04)",
              color: "rgba(0,0,0,0.5)",
              fontSize: 11,
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            save
          </button>
        </div>
      </div>
    </div>
  );
}

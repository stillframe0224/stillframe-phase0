import { useCallback, useState, useEffect, useRef } from "react";
import { TAP_TARGET_MIN } from "./lib/constants";

/** Track visual viewport offset so the modal stays visible above the iOS keyboard */
function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      // When the keyboard opens, visualViewport.height shrinks but window.innerHeight stays the same.
      // The difference tells us how much space the keyboard occupies.
      const kbHeight = window.innerHeight - vv.height;
      setOffset(kbHeight > 40 ? kbHeight : 0); // threshold to avoid false positives
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return offset;
}

interface MemoModalProps {
  cardId: number;
  initialText: string;
  onSave: (cardId: number, text: string) => void;
  onClose: () => void;
}

export default function MemoModal({ cardId, initialText, onSave, onClose }: MemoModalProps) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const kbOffset = useKeyboardOffset();
  const handleSave = useCallback(() => {
    onSave(cardId, text);
    onClose();
  }, [cardId, onClose, onSave, text]);

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
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        display: "flex",
        alignItems: kbOffset > 0 ? "flex-start" : "center",
        justifyContent: "center",
        paddingTop: kbOffset > 0 ? "max(60px, env(safe-area-inset-top, 20px))" : undefined,
        paddingBottom: kbOffset > 0 ? kbOffset : undefined,
        background: "rgba(0,0,0,0.15)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        transition: "padding 0.2s ease-out",
      }}
    >
      <div
        role="dialog"
        aria-label="Edit memo"
        onPointerDown={(e) => e.stopPropagation()}
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
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              handleSave();
            }
          }}
          placeholder="Add a note..."
          style={{
            flex: "0 0 auto",
            height: 160,
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.1)",
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 14,
            lineHeight: 1.7,
            color: "#111",
            resize: "none",
            outline: "none",
            background: "rgba(0,0,0,0.015)",
            overflowY: "auto",
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
            onClick={handleSave}
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

import { useState, useEffect, useRef } from "react";
import { TAP_TARGET_MIN } from "./lib/constants";

interface TagModalProps {
  cardId: number;
  initialTag: string;
  onSave: (cardId: number, tag: string) => void;
  onClose: () => void;
}

export default function TagModal({ cardId, initialTag, onSave, onClose }: TagModalProps) {
  const [tag, setTag] = useState(initialTag);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
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

  const handleSubmit = () => {
    onSave(cardId, tag);
    onClose();
  };

  return (
    <div
      data-testid="tag-modal"
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
        aria-label="Edit tag"
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1.5px solid rgba(0,0,0,0.12)",
          padding: "20px 22px 16px",
          width: "min(320px, 84vw)",
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
          tag
        </div>
        <input
          ref={inputRef}
          data-testid="tag-input"
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value.slice(0, 40))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="e.g. music, research, todo…"
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.1)",
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#111",
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
            data-testid="tag-save"
            onClick={handleSubmit}
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

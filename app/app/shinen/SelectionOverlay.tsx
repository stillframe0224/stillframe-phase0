import { TAP_TARGET_MIN } from "./lib/constants";
import type { SelectionRect } from "./lib/types";

interface SelectionOverlayProps {
  selRect: SelectionRect | null;
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
}

export default function SelectionOverlay({ selRect, selectedCount, onDelete, onClear }: SelectionOverlayProps) {
  return (
    <>
      {/* Selection rectangle */}
      {selRect && (
        <div
          style={{
            position: "fixed",
            left: Math.min(selRect.startX, selRect.curX),
            top: Math.min(selRect.startY, selRect.curY),
            width: Math.abs(selRect.curX - selRect.startX),
            height: Math.abs(selRect.curY - selRect.startY),
            border: "1.5px solid rgba(79,110,217,0.4)",
            background: "rgba(79,110,217,0.06)",
            borderRadius: 4,
            zIndex: 9998,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Selection toolbar */}
      {selectedCount > 0 && !selRect && (
        <div
          style={{
            position: "fixed",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 10,
            padding: "6px 14px",
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 16px -4px rgba(0,0,0,0.08)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontFamily: "'DM Sans',sans-serif",
              color: "rgba(0,0,0,0.5)",
              fontWeight: 500,
            }}
          >
            {selectedCount} selected
          </span>
          <button
            onClick={onDelete}
            style={{
              background: "rgba(217,79,79,0.08)",
              border: "1px solid rgba(217,79,79,0.2)",
              borderRadius: 6,
              padding: "3px 10px",
              minHeight: TAP_TARGET_MIN,
              fontSize: 10,
              fontFamily: "'DM Sans',sans-serif",
              color: "rgba(217,79,79,0.7)",
              cursor: "pointer",
            }}
          >
            delete
          </button>
          <button
            onClick={onClear}
            style={{
              background: "rgba(0,0,0,0.03)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 6,
              padding: "3px 10px",
              minHeight: TAP_TARGET_MIN,
              fontSize: 10,
              fontFamily: "'DM Sans',sans-serif",
              color: "rgba(0,0,0,0.35)",
              cursor: "pointer",
            }}
          >
            clear
          </button>
        </div>
      )}
    </>
  );
}

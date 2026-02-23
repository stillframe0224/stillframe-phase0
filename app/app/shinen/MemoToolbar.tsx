import { useCallback, useRef } from "react";
import { TAP_TARGET_MIN } from "./lib/constants";

interface MemoToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  hasMemoFilter: boolean;
  onToggleHasMemo: () => void;
  memoById: Record<string, string>;
  onImportMemos: (notes: Record<string, string>) => void;
  onClearMemos: () => void;
}

const BTN: React.CSSProperties = {
  background: "rgba(0,0,0,0.03)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 8,
  padding: "4px 10px",
  minHeight: TAP_TARGET_MIN,
  fontSize: 10,
  fontFamily: "'DM Sans',sans-serif",
  color: "rgba(0,0,0,0.35)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
};

export default function MemoToolbar({
  search,
  onSearchChange,
  hasMemoFilter,
  onToggleHasMemo,
  memoById,
  onImportMemos,
  onClearMemos,
}: MemoToolbarProps) {
  const importRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const payload = {
      schema: "stillframe-memos-v1" as const,
      exportedAt: new Date().toISOString(),
      notes: { ...memoById },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shinen-memos-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [memoById]);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data.schema === "stillframe-memos-v1" && typeof data.notes === "object") {
            onImportMemos(data.notes);
          }
        } catch {
          // invalid JSON — silently ignore
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [onImportMemos],
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <input
        data-testid="search-input"
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="search..."
        style={{
          width: 140,
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid rgba(0,0,0,0.08)",
          fontSize: 11,
          fontFamily: "'DM Sans',sans-serif",
          background: "rgba(255,255,255,0.9)",
          outline: "none",
          color: "rgba(0,0,0,0.5)",
        }}
      />

      <button
        data-testid="filter-has-memo"
        onClick={onToggleHasMemo}
        style={{
          ...BTN,
          background: hasMemoFilter ? "rgba(79,110,217,0.08)" : BTN.background,
          border: hasMemoFilter ? "1px solid rgba(79,110,217,0.3)" : BTN.border,
          color: hasMemoFilter ? "rgba(79,110,217,0.7)" : BTN.color,
        }}
      >
        has memo
      </button>

      <button data-testid="memo-export" onClick={handleExport} style={BTN}>
        export
      </button>

      <button data-testid="memo-clear" onClick={onClearMemos} style={BTN}>
        clear
      </button>

      <input
        ref={importRef}
        data-testid="memo-import-input"
        type="file"
        accept=".json"
        onChange={handleImportFile}
        style={{ display: "none" }}
      />
      <button onClick={() => importRef.current?.click()} style={BTN}>
        import
      </button>
    </div>
  );
}

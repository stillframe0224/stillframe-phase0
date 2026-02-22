import { useState, useCallback, useRef } from "react";
import { TYPES, TAP_TARGET_MIN } from "./lib/constants";

interface FileUploadResult {
  text: string;
  type: number; // card type index (9 = file)
  media?: {
    type: "image" | "video" | "audio" | "pdf";
    url: string;
    thumbnail?: string;
  };
  file?: {
    name: string;
    size: number;
    mimeType: string;
  };
}

interface InputBarProps {
  onSubmit: (text: string) => void;
  onFileUpload?: (result: FileUploadResult) => void;
  time: number;
}

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg,audio/mp4,application/pdf,text/plain,text/markdown";

function detectMediaType(mime: string): "image" | "video" | "audio" | "pdf" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  return null;
}

function cleanFileName(name: string): string {
  // Remove extension
  let title = name.replace(/\.[^/.]+$/, "");
  // Remove UUID patterns (8-4-4-4-12 hex)
  title = title.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "").trim();
  // Remove leading/trailing separators left after UUID removal
  title = title.replace(/^[-_\s]+|[-_\s]+$/g, "").replace(/[-_]{2,}/g, "-");
  // Truncate if > 30 chars
  if (title.length > 30) title = title.slice(0, 27) + "...";
  return title || name.replace(/\.[^/.]+$/, "").slice(0, 27);
}

export default function InputBar({ onSubmit, onFileUpload, time }: InputBarProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText("");
  }, [text, onSubmit]);

  const processFile = useCallback(
    (file: File) => {
      const blobUrl = URL.createObjectURL(file);
      const mediaType = detectMediaType(file.type);
      const title = cleanFileName(file.name);

      if (file.type.startsWith("text/")) {
        // Read text files and put content in card
        const reader = new FileReader();
        reader.onload = () => {
          const content = (reader.result as string).slice(0, 500);
          onFileUpload?.({
            text: content,
            type: 9, // file
            file: { name: file.name, size: file.size, mimeType: file.type },
          });
        };
        reader.readAsText(file);
        return;
      }

      const result: FileUploadResult = {
        text: title,
        type: 9, // file
        file: { name: file.name, size: file.size, mimeType: file.type },
      };

      if (mediaType) {
        result.media = {
          type: mediaType,
          url: blobUrl,
          thumbnail: mediaType === "image" ? blobUrl : undefined,
        };
      }

      onFileUpload?.(result);
    },
    [onFileUpload],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        width: "min(480px, 85vw)",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div
        style={{
          background: dragOver
            ? "rgba(79,110,217,0.06)"
            : focused
              ? "rgba(255,255,255,0.98)"
              : "rgba(255,255,255,0.88)",
          border: dragOver
            ? "1.5px dashed rgba(79,110,217,0.4)"
            : focused
              ? "1.5px solid rgba(0,0,0,0.30)"
              : "1.5px solid rgba(0,0,0,0.22)",
          borderRadius: 14,
          padding: "11px 15px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          transition: "all 0.3s",
          boxShadow: focused ? "0 6px 24px -8px rgba(0,0,0,0.05)" : "0 1px 6px -3px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            flexShrink: 0,
            background: focused ? TYPES[Math.floor(time * 0.0008) % 8].glow : "rgba(0,0,0,0.18)",
            transition: "all 0.3s",
          }}
        />
        <input
          className="si17"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="drop a thought..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: text ? "'Cormorant Garamond',serif" : "'Caveat',cursive",
            fontSize: text ? 14 : 17,
            color: "rgba(0,0,0,0.6)",
            fontWeight: 300,
          }}
        />

        {/* Clip icon button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="attach file"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            minWidth: TAP_TARGET_MIN,
            minHeight: TAP_TARGET_MIN,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.5,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.opacity = "0.75")}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.opacity = "0.5")}
        >
          {/* Plus icon */}
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {text && (
          <button
            onClick={handleSubmit}
            style={{
              background: "rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.06)",
              color: "rgba(0,0,0,0.3)",
              borderRadius: 8,
              padding: "4px 11px",
              minHeight: TAP_TARGET_MIN,
              fontSize: 11,
              fontFamily: "'DM Sans',sans-serif",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            drop ↵
          </button>
        )}
      </div>
      <div
        style={{
          textAlign: "center",
          marginTop: 5,
          fontSize: 8.5,
          color: "rgba(0,0,0,0.18)",
          fontWeight: 300,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        no folders · no tags · no judgment
      </div>
    </div>
  );
}

import { TYPES, SLAB_N, SLAB_GAP, TAP_TARGET_MIN, getCardWidth } from "./lib/constants";
import type { ShinenCard, Projection } from "./lib/types";

interface ThoughtCardProps {
  card: ShinenCard;
  p: Projection;
  camRx: number;
  camRy: number;
  isDragging: boolean;
  isHovered: boolean;
  isSelected: boolean;
  isPlaying?: boolean;
  time: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onEnter: () => void;
  onLeave: () => void;
  onMediaClick?: () => void;
  onResizeStart?: (cardId: number, e: React.PointerEvent) => void;
  onDelete?: (cardId: number) => void;
}

export default function ThoughtCard({
  card,
  p,
  camRx,
  camRy,
  isDragging,
  isHovered,
  isSelected,
  isPlaying = false,
  time,
  onPointerDown,
  onEnter,
  onLeave,
  onMediaClick,
  onResizeStart,
  onDelete,
}: ThoughtCardProps) {
  const t = TYPES[card.type] ?? TYPES[0];
  const floatY = isDragging ? 0 : Math.sin(time * 0.0005 + card.id * 2.1) * 3;

  // When playing video/youtube, expand card width
  const isVideoPlaying = isPlaying && card.media && (card.media.type === "video" || card.media.type === "youtube");
  const baseWidth = card.w ?? getCardWidth();
  const cardWidth = isVideoPlaying ? Math.max(420, baseWidth * 2) : baseWidth;

  const sc = isDragging ? p.s * 1.05 : isHovered ? p.s * 1.02 : p.s;
  const edgeX = camRy * 0.035;
  const edgeY = -camRx * 0.025;
  const liftY = isDragging ? 28 : isHovered ? 18 : 11;
  const liftBlur = isDragging ? 42 : isHovered ? 28 : 18;
  const liftA = isDragging ? 0.15 : isHovered ? 0.1 : 0.07;

  const selectedBorder = isSelected ? "2px solid rgba(79,110,217,0.5)" : "1.5px solid rgba(0,0,0,0.3)";
  const selectedGlow = isSelected ? "0 0 12px 2px rgba(79,110,217,0.2)" : "";

  const hasMedia = card.media != null;

  return (
    <div
      data-shinen-card={card.id}
      data-testid="shinen-card"
      onPointerDown={onPointerDown}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: cardWidth,
        transform: `translate(-50%,-50%) translate(${p.sx}px,${p.sy + floatY}px) scale(${sc})`,
        transition: isDragging ? "none" : "transform 0.4s cubic-bezier(0.22,0.61,0.36,1), width 0.3s ease",
        cursor: isDragging ? "grabbing" : "grab",
        zIndex: isPlaying ? 10000 : isDragging ? 9999 : Math.round(1000 + p.z2),
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {/* Slab layers (3D thickness) */}
      {Array.from({ length: SLAB_N }, (_, i) => {
        const li = SLAB_N - i;
        const shade = 218 - li * 12;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 10,
              background: `rgb(${shade},${shade},${shade})`,
              border: "1.5px solid rgba(0,0,0,0.22)",
              transform: `translate(${edgeX * li * SLAB_GAP}px,${edgeY * li * SLAB_GAP}px)`,
              transition: isDragging ? "none" : "transform 0.4s cubic-bezier(0.22,0.61,0.36,1)",
              zIndex: -li,
            }}
          />
        );
      })}

      {/* Main card face */}
      <div
        data-testid="shinen-card-face"
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 10,
          border: selectedBorder,
          padding: "16px 18px 13px",
          minHeight: card.h ?? TAP_TARGET_MIN,
          boxShadow: `0 ${liftY}px ${liftBlur}px -${Math.round(liftBlur * 0.3)}px rgba(0,0,0,${liftA})${selectedGlow ? `, ${selectedGlow}` : ""}`,
          transition: isDragging ? "none" : "box-shadow 0.35s",
          overflow: "hidden",
        }}
      >
        {/* Media preview / playback area */}
        {hasMedia && <MediaPreview card={card} isPlaying={isPlaying} onMediaClick={onMediaClick} />}

        {/* Text content */}
        <div
          style={{
            fontFamily: "'Cormorant Garamond','Noto Serif JP',Georgia,serif",
            fontSize: 14,
            lineHeight: 1.7,
            color: "#111",
            fontWeight: 400,
            whiteSpace: "pre-line",
            marginTop: hasMedia ? 10 : 0,
          }}
        >
          {card.text}
        </div>

        {/* Type label */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderTop: "1px solid rgba(0,0,0,0.07)",
            paddingTop: 8,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.glow, opacity: 0.7 }} />
          <span
            style={{
              fontSize: 9,
              fontFamily: "'DM Sans',sans-serif",
              color: "rgba(0,0,0,0.3)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontWeight: 500,
            }}
          >
            {t.label}
          </span>
          {card.file && (
            <span
              style={{
                fontSize: 8,
                fontFamily: "'DM Sans',sans-serif",
                color: "rgba(0,0,0,0.2)",
                marginLeft: "auto",
              }}
            >
              {formatSize(card.file.size)}
            </span>
          )}
        </div>

        {/* Open link button (top-right, left of delete — only for cards with source URL) */}
        {isHovered && card.source?.url && (
          <button
            data-no-drag
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              window.open(card.source!.url, "_blank", "noopener,noreferrer");
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Open in new tab"
            style={{
              position: "absolute",
              right: 22,
              top: 4,
              width: 16,
              height: 16,
              padding: 0,
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.2,
              fontSize: 11,
              lineHeight: 1,
              color: "#000",
              fontFamily: "'DM Sans',sans-serif",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.6")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.2")}
          >
            ↗
          </button>
        )}

        {/* Delete button (top-right corner) */}
        {isHovered && (
          <button
            data-no-drag
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete?.(card.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              right: 4,
              top: 4,
              width: 16,
              height: 16,
              padding: 0,
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.2,
              fontSize: 12,
              lineHeight: 1,
              color: "#000",
              fontFamily: "'DM Sans',sans-serif",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.2")}
          >
            ×
          </button>
        )}

        {/* Resize grip (bottom-right corner) */}
        {isHovered && (
          <div
            data-no-drag
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onResizeStart?.(card.id, e);
            }}
            style={{
              position: "absolute",
              right: 2,
              bottom: 2,
              width: 16,
              height: 16,
              cursor: "nwse-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.3,
            }}
          >
            <svg width={8} height={8} viewBox="0 0 8 8" stroke="rgba(0,0,0,0.5)" strokeWidth="1" fill="none">
              <line x1="7" y1="1" x2="1" y2="7" />
              <line x1="7" y1="4" x2="4" y2="7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

// Media preview sub-component (inside ThoughtCard)
function MediaPreview({
  card,
  isPlaying,
  onMediaClick,
}: {
  card: ShinenCard;
  isPlaying: boolean;
  onMediaClick?: () => void;
}) {
  const media = card.media;
  if (!media) return null;

  // Image thumbnail — click to open full image
  if (media.type === "image") {
    return (
      <div
        data-no-drag
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); window.open(media.url, "_blank"); }}
        style={{ margin: "-16px -18px 0", borderRadius: "8px 8px 0 0", overflow: "hidden", cursor: "zoom-in" }}
      >
        <img
          src={media.url}
          alt={card.text}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: 180,
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    );
  }

  // YouTube embed
  if (media.type === "youtube" && media.youtubeId) {
    if (isPlaying) {
      return (
        <div style={{ margin: "-16px -18px 0", borderRadius: "8px 8px 0 0", overflow: "hidden" }}>
          <iframe
            src={`https://www.youtube.com/embed/${media.youtubeId}?autoplay=1`}
            style={{ width: "100%", aspectRatio: "16/9", border: "none", display: "block" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    return (
      <div
        data-no-drag
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onMediaClick?.();
        }}
        style={{
          margin: "-16px -18px 0",
          borderRadius: "8px 8px 0 0",
          overflow: "hidden",
          position: "relative",
          cursor: "pointer",
        }}
      >
        <img
          src={media.thumbnail || `https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg`}
          alt={card.text}
          style={{ width: "100%", height: "auto", maxHeight: 180, objectFit: "cover", display: "block" }}
        />
        {/* Play button overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="rgba(0,0,0,0.7)">
              <polygon points="8,5 19,12 8,19" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Video (local)
  if (media.type === "video") {
    if (isPlaying) {
      return (
        <div style={{ margin: "-16px -18px 0", borderRadius: "8px 8px 0 0", overflow: "hidden" }}>
          <video
            src={media.url}
            autoPlay
            controls
            style={{ width: "100%", display: "block", maxHeight: 240 }}
          />
        </div>
      );
    }
    return (
      <div
        data-no-drag
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onMediaClick?.();
        }}
        style={{
          margin: "-16px -18px 0",
          borderRadius: "8px 8px 0 0",
          overflow: "hidden",
          position: "relative",
          cursor: "pointer",
          background: "rgba(0,0,0,0.04)",
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="rgba(0,0,0,0.4)">
            <polygon points="8,5 19,12 8,19" />
          </svg>
        </div>
      </div>
    );
  }

  // Audio — always show waveform icon + play button (prominent before playback)
  if (media.type === "audio") {
    return (
      <div
        style={{
          margin: "-16px -18px 0 -18px",
          padding: isPlaying ? "12px 18px" : "20px 18px",
          background: "rgba(0,0,0,0.03)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: isPlaying ? "flex-start" : "center",
          gap: 12,
        }}
      >
        {isPlaying ? (
          <audio src={media.url} autoPlay controls style={{ height: 28, flex: 1 }} />
        ) : (
          <div
            data-no-drag
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onMediaClick?.(); }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", width: "100%" }}
          >
            {/* Large waveform icon */}
            <svg width={48} height={28} viewBox="0 0 48 28" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="10" x2="6" y2="18" />
              <line x1="12" y1="6" x2="12" y2="22" />
              <line x1="18" y1="2" x2="18" y2="26" />
              <line x1="24" y1="5" x2="24" y2="23" />
              <line x1="30" y1="8" x2="30" y2="20" />
              <line x1="36" y1="4" x2="36" y2="24" />
              <line x1="42" y1="10" x2="42" y2="18" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width={10} height={10} viewBox="0 0 24 24" fill="rgba(0,0,0,0.3)">
                <polygon points="8,5 19,12 8,19" />
              </svg>
              <span style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", fontFamily: "'DM Sans',sans-serif", letterSpacing: "0.05em" }}>PLAY</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // PDF icon
  // PDF — click to open in new tab
  if (media.type === "pdf") {
    return (
      <div
        data-no-drag
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); window.open(media.url, "_blank"); }}
        style={{
          margin: "-16px -18px 0 -18px",
          padding: "16px 18px",
          background: "rgba(0,0,0,0.02)",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", fontFamily: "'DM Sans',sans-serif" }}>
          PDF
        </span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
    );
  }

  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

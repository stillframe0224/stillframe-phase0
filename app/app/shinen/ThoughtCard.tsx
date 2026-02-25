import { useCallback, useEffect, useRef, useState } from "react";
import { SLAB_N, SLAB_GAP, TAP_TARGET_MIN, getCardWidth } from "./lib/constants";
import type { ShinenCard, Projection } from "./lib/types";
import { toProxySrc } from "./lib/proxy";
import { inferDomain, logDiagEvent } from "./lib/diag";
import { stopOpenLinkEventPropagation } from "./lib/openLinkGuards";
import { getThumbRenderMode } from "./lib/thumbRender.mjs";
import {
  createEmbedLoadState,
  EMBED_WATCHDOG_TIMEOUT_MS,
  completeEmbedLoad,
  isEmbedTimedOut,
  startEmbedLoad,
  timeoutEmbedLoad,
} from "./lib/embedWatchdog.mjs";

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
  memo?: string;
  tag?: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onEnter: () => void;
  onLeave: () => void;
  onMediaClick?: () => void;
  onMemoClick?: (cardId: number) => void;
  onTagClick?: (cardId: number) => void;
  onReorderDragStart?: (cardId: number, e: React.PointerEvent) => void;
  onResizeStart?: (cardId: number, e: React.PointerEvent) => void;
  onDelete?: (cardId: number) => void;
}

function buildCardSnapshot(card: ShinenCard, linkUrl: string | null, thumbnailUrl: string | null) {
  return {
    cardId: card.id,
    domain: inferDomain(linkUrl ?? thumbnailUrl ?? card.source?.url ?? card.media?.url ?? null),
    link_url: linkUrl,
    thumbnail_url: thumbnailUrl,
    title: (card.text ?? "").split("\n")[0]?.slice(0, 160) ?? "",
    kind: card.media?.type ?? `type-${card.type}`,
  };
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
  memo,
  tag,
  onPointerDown,
  onEnter,
  onLeave,
  onMediaClick,
  onMemoClick,
  onTagClick,
  onReorderDragStart,
  onResizeStart,
  onDelete,
}: ThoughtCardProps) {
  const floatY = isDragging ? 0 : Math.sin(time * 0.0005 + card.id * 2.1) * 3;

  // When playing video/youtube, expand card width
  const isVideoPlaying =
    isPlaying &&
    card.media &&
    (card.media.type === "video" || card.media.type === "youtube" || card.media.type === "embed" || card.media.kind === "embed");
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
      data-testid="card-item"
      data-card-id={String(card.id)}
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

      {/* Main card shell: decorative face is below, controls/content above */}
      <div
        style={{
          position: "relative",
          borderRadius: 10,
          minHeight: card.h ?? TAP_TARGET_MIN,
          overflow: "hidden",
        }}
      >
        <div
          data-testid="shinen-card-face"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            background: "#fff",
            borderRadius: 10,
            border: selectedBorder,
            boxShadow: `0 ${liftY}px ${liftBlur}px -${Math.round(liftBlur * 0.3)}px rgba(0,0,0,${liftA})${selectedGlow ? `, ${selectedGlow}` : ""}`,
            transition: isDragging ? "none" : "box-shadow 0.35s",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            pointerEvents: "auto",
            padding: "16px 18px 13px",
            minHeight: card.h ?? TAP_TARGET_MIN,
          }}
        >
        {/* Media preview / playback area */}
        {hasMedia && <MediaPreview card={card} isPlaying={isPlaying} onMediaClick={onMediaClick} />}

        {/* Text content */}
        {card.type === 8 ? (() => {
          // CLIP card: split "title\n\ndesc" and render separately
          const parts = card.text ? card.text.split("\n\n") : [];
          const clipTitle = parts[0] ?? "";
          const clipDesc = parts.slice(1).join("\n\n").trim();
          // Determine site icon: YouTube/Amazon fixed, others use fetched favicon
          const siteIcon = (() => {
            const url = card.source?.url ?? "";
            try {
              const h = new URL(url).hostname.toLowerCase();
              if (h.includes("youtube.com") || h === "youtu.be") return "https://www.youtube.com/favicon.ico";
              if (h.includes("amazon.") || h.includes("amzn.") || h === "a.co") return "https://www.amazon.com/favicon.ico";
            } catch { /* ignore */ }
            return card.source?.favicon ?? null;
          })();
          return (
            <div style={{ marginTop: hasMedia ? 10 : 0 }}>
              {/* Title — 2-line clamp, serif, with site icon */}
              <div
                style={{
                  fontFamily: "'Cormorant Garamond','Noto Serif JP',Georgia,serif",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#111",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 5,
                }}
              >
                {siteIcon && (
                  <img
                    src={siteIcon}
                    alt=""
                    style={{
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      marginTop: 4,
                      borderRadius: 2,
                      objectFit: "contain",
                    }}
                  />
                )}
                <span
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  {clipTitle}
                </span>
              </div>
              {/* Desc — 2-line clamp, sans-serif, muted */}
              {clipDesc ? (
                <div
                  data-testid="clip-desc"
                  style={{
                    marginTop: 4,
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 11,
                    lineHeight: 1.55,
                    color: "rgba(0,0,0,0.42)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                    whiteSpace: "pre-line",
                  }}
                >
                  {clipDesc}
                </div>
              ) : null}
            </div>
          );
        })() : (
          <div
            style={{
              fontFamily: "'Cormorant Garamond','Noto Serif JP',Georgia,serif",
              fontSize: 14,
              lineHeight: 1.7,
              color: "#111",
              fontWeight: 400,
              whiteSpace: "pre-line",
              marginTop: hasMedia ? 10 : 0,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }}
          >
            {card.text}
          </div>
        )}

        {/* Memo snippet (if card has a memo) */}
        {memo && (
          <div
            data-testid="memo-snippet"
            style={{
              position: "relative",
              zIndex: 10,
              marginTop: 8,
              padding: "6px 8px",
              background: "rgba(79,110,217,0.04)",
              borderRadius: 6,
              fontSize: 11,
              fontFamily: "'DM Sans',sans-serif",
              color: "rgba(0,0,0,0.35)",
              lineHeight: 1.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {memo.length > 60 ? memo.slice(0, 57) + "..." : memo}
          </div>
        )}

        {/* Chip bar */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderTop: "1px solid rgba(0,0,0,0.07)",
            paddingTop: 8,
          }}
        >
          <button
            data-testid="chip-memo"
            data-no-drag
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onMemoClick?.(card.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              zIndex: 11,
              marginLeft: 0,
              padding: "2px 7px",
              borderRadius: 6,
              border: memo ? "1px solid rgba(79,110,217,0.25)" : "1px solid rgba(0,0,0,0.08)",
              background: memo ? "rgba(79,110,217,0.06)" : "rgba(0,0,0,0.02)",
              color: memo ? "rgba(79,110,217,0.6)" : "rgba(0,0,0,0.25)",
              fontSize: 8,
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            memo
          </button>
          {/* Tag chip — shown only when tag exists */}
          {tag && (
            <button
              data-testid="chip-tag"
              data-no-drag
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onTagClick?.(card.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: "relative",
                zIndex: 11,
                marginLeft: 0,
                padding: "2px 7px",
                borderRadius: 6,
                border: "1px solid rgba(45,143,80,0.25)",
                background: "rgba(45,143,80,0.06)",
                color: "rgba(45,143,80,0.65)",
                fontSize: 8,
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 500,
                letterSpacing: "0.04em",
                cursor: "pointer",
                lineHeight: 1,
                maxWidth: 80,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tag}
            </button>
          )}
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

        {/* Drag handle (top-left corner) — always in DOM so Playwright count works pre-hover */}
        <div
          data-testid="drag-handle"
          data-no-drag
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReorderDragStart?.(card.id, e);
          }}
          style={{
            position: "absolute",
            zIndex: 20,
            left: 4,
            top: 4,
            width: 16,
            height: 16,
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: isHovered ? 0.2 : 0.12,
            transition: "opacity 0.15s",
            pointerEvents: "auto",
          }}
        >
          <svg width={10} height={10} viewBox="0 0 10 10" fill="rgba(0,0,0,0.5)">
            <circle cx="3" cy="2" r="1" />
            <circle cx="7" cy="2" r="1" />
            <circle cx="3" cy="5" r="1" />
            <circle cx="7" cy="5" r="1" />
            <circle cx="3" cy="8" r="1" />
            <circle cx="7" cy="8" r="1" />
          </svg>
        </div>

        {/* Delete button (top-right corner) — larger hit target */}
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
              zIndex: 20,
              right: 2,
              top: 2,
              width: 28,
              height: 28,
              padding: 0,
              background: "rgba(0,0,0,0.04)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.3,
              fontSize: 18,
              lineHeight: 1,
              color: "#000",
              fontFamily: "'DM Sans',sans-serif",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.6")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.3")}
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
              zIndex: 20,
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
  const isEmbedMedia = media.type === "embed" || media.kind === "embed";
  const [embedLoadState, setEmbedLoadState] = useState(() => createEmbedLoadState());
  const embedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embedSessionKeyRef = useRef<string | null>(null);
  const embedLinkUrl = card.source?.url ?? media.url ?? media.embedUrl ?? null;
  const embedPosterUrl = media.posterUrl || media.thumbnail || null;

  const clearEmbedWatchdog = useCallback(() => {
    if (embedTimerRef.current) {
      clearTimeout(embedTimerRef.current);
      embedTimerRef.current = null;
    }
  }, []);

  const startEmbedWatchdog = useCallback(
    (reason: "start" | "retry") => {
      if (!isEmbedMedia || !media.embedUrl) return;
      clearEmbedWatchdog();
      const startedAtMs = Date.now();
      setEmbedLoadState((prev) => startEmbedLoad(prev, startedAtMs));
      logDiagEvent({
        type: reason === "start" ? "embed_load_start" : "embed_retry",
        cardId: card.id,
        domain: inferDomain(embedLinkUrl ?? media.embedUrl),
        link_url: embedLinkUrl,
        thumbnail_url: embedPosterUrl,
        extra: {
          provider: media.provider ?? "embed",
          embedUrl: media.embedUrl,
          timeoutMs: EMBED_WATCHDOG_TIMEOUT_MS,
          cardSnapshot: buildCardSnapshot(card, embedLinkUrl, embedPosterUrl),
        },
      });
      embedTimerRef.current = setTimeout(() => {
        const nowMs = Date.now();
        setEmbedLoadState((prev) => {
          if (!isEmbedTimedOut(prev, nowMs)) return prev;
          const next = timeoutEmbedLoad(prev, nowMs);
          logDiagEvent({
            type: "embed_load_timeout",
            cardId: card.id,
            domain: inferDomain(embedLinkUrl ?? media.embedUrl),
            link_url: embedLinkUrl,
            thumbnail_url: embedPosterUrl,
            extra: {
              provider: media.provider ?? "embed",
              embedUrl: media.embedUrl,
              elapsedMs: next.elapsedMs,
              timeoutMs: EMBED_WATCHDOG_TIMEOUT_MS,
              cardSnapshot: buildCardSnapshot(card, embedLinkUrl, embedPosterUrl),
            },
          });
          return next;
        });
      }, EMBED_WATCHDOG_TIMEOUT_MS);
    },
    [card, clearEmbedWatchdog, embedLinkUrl, embedPosterUrl, isEmbedMedia, media],
  );

  useEffect(() => {
    if (!isEmbedMedia || !media.embedUrl || !isPlaying) {
      embedSessionKeyRef.current = null;
      clearEmbedWatchdog();
      setEmbedLoadState(createEmbedLoadState());
      return;
    }
    const sessionKey = `${card.id}:${media.embedUrl}`;
    if (embedSessionKeyRef.current === sessionKey) return;
    embedSessionKeyRef.current = sessionKey;
    startEmbedWatchdog("start");
    return () => {
      clearEmbedWatchdog();
    };
  }, [card.id, clearEmbedWatchdog, isEmbedMedia, isPlaying, media.embedUrl, startEmbedWatchdog]);

  // Image thumbnail — click to open full image
  if (media.type === "image" && !isEmbedMedia) {
    const proxiedSrc = toProxySrc(media.url, card.source?.url);
    const linkUrl = card.source?.url ?? media.url;
    const thumbUrl = media.url;
    const renderMode = getThumbRenderMode(card.source?.url ?? media.url);
    return (
      <a
        data-testid="card-image-link"
        data-no-drag
        data-open-link="1"
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        onPointerDownCapture={(e) => {
          (e.currentTarget as HTMLAnchorElement).dataset.pointerDownPrevented = e.defaultPrevented ? "1" : "0";
        }}
        onPointerDown={(e) => stopOpenLinkEventPropagation(e)}
        onMouseDown={(e) => stopOpenLinkEventPropagation(e)}
        onClickCapture={(e) => {
          const pointerDownPrevented =
            (e.currentTarget as HTMLAnchorElement).dataset.pointerDownPrevented === "1";
          logDiagEvent({
            type: "open_click",
            cardId: card.id,
            domain: inferDomain(linkUrl ?? thumbUrl),
            link_url: linkUrl,
            thumbnail_url: thumbUrl,
            extra: {
              clickDefaultPrevented: e.defaultPrevented,
              pointerDownDefaultPrevented: pointerDownPrevented,
              cardSnapshot: buildCardSnapshot(card, linkUrl, thumbUrl),
            },
          });
        }}
        onClick={(e) => stopOpenLinkEventPropagation(e)}
        onAuxClick={(e) => stopOpenLinkEventPropagation(e)}
        style={{
          margin: "-16px -18px 0 -18px",
          borderRadius: "10px 10px 0 0",
          overflow: "hidden",
          cursor: "pointer",
          padding: 0,
          background: "transparent",
          border: "none",
          display: "block",
          lineHeight: 0,
          textDecoration: "none",
          position: "relative",
          height: 96,
        }}
      >
        {renderMode === "contain_blur" && (
          <img
            src={proxiedSrc}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(14px)",
              transform: "scale(1.08)",
              opacity: 0.9,
              pointerEvents: "none",
              border: "none",
              margin: 0,
              padding: 0,
            }}
          />
        )}
        <img
          src={proxiedSrc}
          alt={card.text}
          onError={(e) => {
            logDiagEvent({
              type: "thumb_error",
              cardId: card.id,
              domain: inferDomain(linkUrl),
              link_url: linkUrl,
              thumbnail_url: thumbUrl,
              extra: {
                src: e.currentTarget.currentSrc || proxiedSrc,
                proxy_url: proxiedSrc,
                mediaType: media.type,
                cardSnapshot: buildCardSnapshot(card, linkUrl, thumbUrl),
              },
            });
          }}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            objectFit: renderMode === "contain_blur" ? "contain" : "cover",
            display: "block",
            background: "transparent",
            border: "none",
            margin: 0,
            padding: 0,
          }}
        />
      </a>
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
      // Thumbnail click toggles inline playback; still track thumbnail load failures.
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
          src={toProxySrc(media.thumbnail || `https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg`)}
          alt={card.text}
          onError={(e) => {
            const thumb = media.thumbnail || `https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg`;
            const proxyUrl = toProxySrc(thumb);
            const linkUrl = card.source?.url ?? media.url;
            logDiagEvent({
              type: "thumb_error",
              cardId: card.id,
              domain: inferDomain(linkUrl),
              link_url: linkUrl,
              thumbnail_url: thumb,
              extra: {
                src: e.currentTarget.currentSrc || proxyUrl,
                proxy_url: proxyUrl,
                mediaType: media.type,
                cardSnapshot: buildCardSnapshot(card, linkUrl, thumb),
              },
            });
          }}
          style={{ width: "100%", height: 96, objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  // Generic embed player (X / Instagram / future providers)
  if (isEmbedMedia && media.embedUrl) {
    const poster = embedPosterUrl;
    const showTimeoutFallback = isPlaying && embedLoadState.status === "timeout";
    if (isPlaying) {
      return (
        <div style={{ margin: "-16px -18px 0", borderRadius: "8px 8px 0 0", overflow: "hidden" }}>
          {!showTimeoutFallback ? (
            <iframe
              src={media.embedUrl}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
              onLoad={() => {
                clearEmbedWatchdog();
                const nowMs = Date.now();
                setEmbedLoadState((prev) => {
                  const next = completeEmbedLoad(prev, nowMs);
                  if (prev.status === "loading" && next.status === "loaded") {
                    logDiagEvent({
                      type: "embed_load_ok",
                      cardId: card.id,
                      domain: inferDomain(embedLinkUrl ?? media.embedUrl),
                      link_url: embedLinkUrl,
                      thumbnail_url: poster,
                      extra: {
                        provider: media.provider ?? "embed",
                        embedUrl: media.embedUrl,
                        elapsedMs: next.elapsedMs,
                        cardSnapshot: buildCardSnapshot(card, embedLinkUrl, poster),
                      },
                    });
                  }
                  return next;
                });
              }}
              style={{ width: "100%", aspectRatio: "16/9", border: "none", display: "block", background: "#000" }}
              allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
              allowFullScreen
            />
          ) : (
            <div
              data-testid="embed-timeout-fallback"
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16/9",
                background: "rgba(0,0,0,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {poster ? (
                <img
                  src={toProxySrc(poster, card.source?.url)}
                  alt={card.text}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : null}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.38)",
                }}
              />
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "'DM Sans',sans-serif",
                    color: "rgba(255,255,255,0.95)",
                    letterSpacing: "0.02em",
                  }}
                >
                  読み込みできませんでした
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {embedLinkUrl ? (
                    <a
                      data-testid="embed-open-external"
                      data-open-link="1"
                      href={embedLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onPointerDown={(e) => stopOpenLinkEventPropagation(e)}
                      onClickCapture={(e) => {
                        logDiagEvent({
                          type: "embed_open_external",
                          cardId: card.id,
                          domain: inferDomain(embedLinkUrl),
                          link_url: embedLinkUrl,
                          thumbnail_url: poster,
                          extra: {
                            provider: media.provider ?? "embed",
                            embedUrl: media.embedUrl,
                            status: embedLoadState.status,
                            elapsedMs: embedLoadState.elapsedMs,
                            cardSnapshot: buildCardSnapshot(card, embedLinkUrl, poster),
                          },
                        });
                      }}
                      onClick={(e) => stopOpenLinkEventPropagation(e)}
                      onAuxClick={(e) => stopOpenLinkEventPropagation(e)}
                      style={{
                        textDecoration: "none",
                        background: "rgba(255,255,255,0.95)",
                        color: "rgba(0,0,0,0.75)",
                        borderRadius: 6,
                        border: "1px solid rgba(0,0,0,0.12)",
                        fontSize: 11,
                        fontFamily: "'DM Sans',sans-serif",
                        padding: "6px 10px",
                        lineHeight: 1,
                      }}
                    >
                      外部で開く
                    </a>
                  ) : null}
                  <button
                    data-testid="embed-retry"
                    data-no-drag
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      startEmbedWatchdog("retry");
                    }}
                    style={{
                      background: "rgba(255,255,255,0.95)",
                      color: "rgba(0,0,0,0.75)",
                      borderRadius: 6,
                      border: "1px solid rgba(0,0,0,0.12)",
                      fontSize: 11,
                      fontFamily: "'DM Sans',sans-serif",
                      padding: "6px 10px",
                      lineHeight: 1,
                      cursor: "pointer",
                    }}
                  >
                    再試行
                  </button>
                </div>
              </div>
            </div>
          )}
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
          height: 96,
          background: "rgba(0,0,0,0.08)",
        }}
      >
        {poster ? (
          <img
            src={toProxySrc(poster, card.source?.url)}
            alt={card.text}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: poster ? "rgba(0,0,0,0.18)" : "transparent",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="rgba(0,0,0,0.55)">
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
      <a
        data-no-drag
        href={media.url}
        target="_blank"
        rel="noopener noreferrer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: "-16px -18px 0 -18px",
          padding: "16px 18px",
          background: "rgba(0,0,0,0.02)",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          textDecoration: "none",
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
      </a>
    );
  }

  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

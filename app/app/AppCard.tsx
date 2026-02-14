"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCardType } from "@/lib/cardTypes";
import { extractFirstHttpUrl, getYouTubeThumbnail } from "@/lib/urlUtils";
import type { Card } from "@/lib/supabase/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Module-level preview cache: url -> image (null = confirmed no image)
const previewCache = new Map<string, string | null>();

// Debug mode: ?debug=1 in URL or localStorage SHINEN_DEBUG_PREVIEW=1
let _debugChecked = false;
let _debugOn = false;
function isDebugPreview(): boolean {
  if (_debugChecked) return _debugOn;
  _debugChecked = true;
  try {
    _debugOn =
      new URLSearchParams(window.location.search).get("debug") === "1" ||
      localStorage.getItem("SHINEN_DEBUG_PREVIEW") === "1";
  } catch {
    _debugOn = false;
  }
  return _debugOn;
}
function dbg(event: string, data?: Record<string, unknown>) {
  if (!isDebugPreview()) return;
  console.log(`[preview] ${event}`, data ?? "");
}

const svgFallbacks: Record<string, React.ReactNode> = {
  memo: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#FFF8F0" />
      <rect x="40" y="25" width="60" height="75" rx="4" fill="#F5C882" opacity="0.3" />
      <line x1="50" y1="40" x2="90" y2="40" stroke="#D9A441" strokeWidth="1.5" opacity="0.5" />
      <line x1="50" y1="50" x2="85" y2="50" stroke="#D9A441" strokeWidth="1.5" opacity="0.4" />
      <line x1="50" y1="60" x2="88" y2="60" stroke="#D9A441" strokeWidth="1.5" opacity="0.3" />
      <circle cx="145" cy="50" r="20" fill="#F5C882" opacity="0.2" />
      <path d="M138 50 L145 43 L152 50 L145 57Z" fill="#D9A441" opacity="0.4" />
    </svg>
  ),
  idea: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#EEF2FF" />
      <circle cx="105" cy="50" r="25" fill="#A0B8F5" opacity="0.25" />
      <path d="M95 45 Q105 20 115 45" stroke="#4F6ED9" strokeWidth="2" fill="none" opacity="0.5" />
      <line x1="105" y1="75" x2="105" y2="90" stroke="#4F6ED9" strokeWidth="2" opacity="0.3" />
      <circle cx="55" cy="35" r="6" fill="#A0B8F5" opacity="0.15" />
      <circle cx="160" cy="75" r="10" fill="#A0B8F5" opacity="0.15" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#FEFCE8" />
      <text x="35" y="60" fontSize="48" fill="#E5D560" opacity="0.4" fontFamily="serif">&ldquo;</text>
      <text x="155" y="90" fontSize="48" fill="#E5D560" opacity="0.4" fontFamily="serif">&rdquo;</text>
      <line x1="65" y1="55" x2="145" y2="55" stroke="#A89620" strokeWidth="1" opacity="0.3" />
      <line x1="75" y1="68" x2="135" y2="68" stroke="#A89620" strokeWidth="1" opacity="0.25" />
    </svg>
  ),
  task: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#F0FFF4" />
      <rect x="50" y="30" width="16" height="16" rx="3" stroke="#7EDBA0" strokeWidth="1.5" fill="none" />
      <path d="M54 38 L58 42 L64 34" stroke="#2D8F50" strokeWidth="2" fill="none" />
      <line x1="75" y1="38" x2="150" y2="38" stroke="#7EDBA0" strokeWidth="1.5" opacity="0.4" />
      <rect x="50" y="55" width="16" height="16" rx="3" stroke="#7EDBA0" strokeWidth="1.5" fill="none" />
      <line x1="75" y1="63" x2="140" y2="63" stroke="#7EDBA0" strokeWidth="1.5" opacity="0.3" />
    </svg>
  ),
  feeling: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#FFF5EB" />
      <path d="M20 70 Q50 30 80 65 Q110 100 140 55 Q170 20 200 60" stroke="#F0B870" strokeWidth="2" fill="none" opacity="0.5" />
      <circle cx="50" cy="45" r="5" fill="#C07820" opacity="0.3" />
      <circle cx="120" cy="80" r="7" fill="#F0B870" opacity="0.25" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#F5F0FF" />
      <rect x="55" y="15" width="100" height="80" rx="2" stroke="#BBA0F5" strokeWidth="1.5" fill="none" opacity="0.4" />
      <rect x="65" y="25" width="80" height="55" rx="1" fill="#BBA0F5" opacity="0.15" />
      <circle cx="85" cy="42" r="8" fill="#7B4FD9" opacity="0.2" />
    </svg>
  ),
  fragment: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#F0FDFA" />
      <path d="M0 85 Q30 75 60 80 Q100 88 140 78 Q180 68 210 75" fill="#70D4C0" opacity="0.15" />
      <path d="M0 95 Q50 85 100 90 Q150 95 210 88" fill="#70D4C0" opacity="0.1" />
      <circle cx="170" cy="35" r="15" fill="#70D4C0" opacity="0.1" />
    </svg>
  ),
  dream: (
    <svg viewBox="0 0 210 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="210" height="120" fill="#FDF2F8" />
      <rect x="60" y="50" width="18" height="40" rx="1" fill="#F0A0D0" opacity="0.2" />
      <rect x="82" y="35" width="18" height="55" rx="1" fill="#F0A0D0" opacity="0.25" />
      <rect x="104" y="45" width="18" height="45" rx="1" fill="#F0A0D0" opacity="0.2" />
      <circle cx="130" cy="25" r="8" fill="#C04890" opacity="0.15" />
      <circle cx="50" cy="30" r="2" fill="#F0A0D0" opacity="0.3" />
    </svg>
  ),
};

interface AppCardProps {
  card: Card;
  index: number;
  onDelete: (id: string) => void;
  onPinToggle?: (id: string, newPinned: boolean) => void;
  isDraggable?: boolean;
}

export default function AppCard({ card, index, onDelete, onPinToggle, isDraggable = false }: AppCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: !isDraggable });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const ct = getCardType(card.card_type);
  const [realImgFailed, setRealImgFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [proxiedUrl, setProxiedUrl] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(card.pinned ?? false);
  const [pinError, setPinError] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [memoText, setMemoText] = useState(card.notes || "");
  const [memoSaveStatus, setMemoSaveStatus] = useState<"saved" | "error" | null>(null);
  const [memoError, setMemoError] = useState<string | null>(null);
  const [showMemoPreview, setShowMemoPreview] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const memoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  const cardUrl = extractFirstHttpUrl(card.text);
  const hasRealImage = !!(card.image_url && card.image_source !== "generated" && !realImgFailed);

  // Derive display title: prefer card.title, fallback to first line of text
  const displayTitle = card.title || card.text.split("\n")[0];
  const siteName = card.site_name || null;

  // Image priority: preview_image_url > image_url > link-preview chain
  const hasPreviewImageUrl = !!(card.preview_image_url && !realImgFailed);

  // IntersectionObserver — fetch preview only when card is near viewport
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Lazy-fetch link preview — only when visible and no preview_image_url
  useEffect(() => {
    if (!isVisible || hasPreviewImageUrl || hasRealImage || !cardUrl) return;
    dbg("url", { cardId: card.id, url: cardUrl });

    // YouTube: derive thumbnail directly (no API call)
    const ytThumb = getYouTubeThumbnail(cardUrl);
    if (ytThumb) {
      dbg("source", { url: cardUrl, source: "youtube" });
      setPreviewImg(ytThumb);
      return;
    }

    // Check in-memory cache (covers both "has image" and "no image" results)
    const cached = previewCache.get(cardUrl);
    if (cached !== undefined) {
      dbg("cache_hit", { url: cardUrl, hasImage: !!cached });
      setPreviewImg(cached);
      return;
    }

    // Fetch from link-preview API
    const controller = new AbortController();
    const t0 = performance.now();
    const debugParam = isDebugPreview() ? "&debug=1" : "";
    fetch(`/api/link-preview?url=${encodeURIComponent(cardUrl)}${debugParam}`, {
      signal: controller.signal,
    })
      .then((r) => {
        dbg("fetch", { url: cardUrl, status: r.status, ms: Math.round(performance.now() - t0) });
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        const image = data?.image ?? null;
        previewCache.set(cardUrl, image);
        dbg("source", { url: cardUrl, source: image ? "api" : "none" });
        if (!controller.signal.aborted) setPreviewImg(image);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [card.id, cardUrl, hasPreviewImageUrl, hasRealImage, isVisible]);

  // Image priority: preview_image_url > image_url > link-preview chain
  const displayImage = hasPreviewImageUrl ? card.preview_image_url! : (hasRealImage ? card.image_url! : (previewFailed ? null : previewImg));
  const showImage = !!displayImage;
  const isProxied = !!proxiedUrl && proxiedUrl === displayImage;

  // When proxied, route through same-origin image proxy (bypasses hotlink 403s)
  const imgSrc = isProxied
    ? `/api/image-proxy?url=${encodeURIComponent(displayImage!)}${cardUrl ? `&ref=${encodeURIComponent(cardUrl)}` : ""}`
    : displayImage;

  const debugSource = !cardUrl ? "none"
    : !showImage ? "svg"
    : isProxied ? "proxy"
    : hasRealImage ? "saved"
    : getYouTubeThumbnail(cardUrl) ? "youtube"
    : "api";

  const [pinErrorMsg, setPinErrorMsg] = useState<string | null>(null);

  const handlePinToggle = async () => {
    const newPinned = !isPinned;
    const oldPinned = isPinned;

    // Optimistic update
    setIsPinned(newPinned);
    setPinError(false);
    setPinErrorMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("cards")
        .update({ pinned: newPinned })
        .eq("id", card.id);

      if (error) {
        // Revert on error
        setIsPinned(oldPinned);
        setPinError(true);

        // Generate human-readable error message
        let msg = "Pin failed";
        const errMsg = error.message || "";
        const errCode = error.code || "";

        // PGRST204 = PostgREST "column not found", 42703 = PostgreSQL "column does not exist"
        if (errCode === "PGRST204" || errCode === "42703" || errMsg.includes("column") || errMsg.includes("pinned")) {
          msg = "Run migration: ALTER TABLE cards ADD COLUMN pinned boolean DEFAULT false;";
        } else if (errCode === "42501" || errMsg.includes("permission") || errMsg.includes("policy")) {
          msg = "Add RLS UPDATE policy in Supabase";
        } else if (errMsg) {
          msg = `Error: ${errMsg.slice(0, 50)}`;
        }

        setPinErrorMsg(msg);
        console.error("Pin toggle failed:", error);
        setTimeout(() => {
          setPinError(false);
          setPinErrorMsg(null);
        }, 5000);
        return;
      }

      // Notify parent to update state
      if (onPinToggle) onPinToggle(card.id, newPinned);
    } catch (e) {
      setIsPinned(oldPinned);
      setPinError(true);
      setPinErrorMsg("Network error");
      setTimeout(() => {
        setPinError(false);
        setPinErrorMsg(null);
      }, 5000);
    }
  };

  const handleTitleClick = () => {
    if (!card.title && card.title !== null) return; // Only allow editing if title column exists
    setEditedTitle(displayTitle);
    setIsEditingTitle(true);
    setTitleError(null);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleTitleSave = async () => {
    const newTitle = editedTitle.trim();
    if (newTitle === displayTitle) {
      setIsEditingTitle(false);
      return;
    }

    const oldTitle = card.title;
    card.title = newTitle || null; // Optimistic update

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("cards")
        .update({ title: newTitle || null })
        .eq("id", card.id);

      if (error) {
        card.title = oldTitle; // Revert
        const errMsg = error.message || "";
        const errCode = error.code || "";
        if (errCode === "PGRST204" || errCode === "42703" || errMsg.includes("column") || errMsg.includes("title")) {
          setTitleError("Run migration SQL to enable title editing (see OPS.md)");
        } else {
          setTitleError(`Save failed: ${errMsg.slice(0, 40)}`);
        }
        setTimeout(() => setTitleError(null), 5000);
        return;
      }

      setIsEditingTitle(false);
    } catch (e) {
      card.title = oldTitle; // Revert
      setTitleError("Network error");
      setTimeout(() => setTitleError(null), 5000);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === "Escape") {
      setIsEditingTitle(false);
      setTitleError(null);
    }
  };

  const handleMemoSave = async (text: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("cards")
        .update({ notes: text || null })
        .eq("id", card.id);

      if (error) {
        const errMsg = error.message || "";
        const errCode = error.code || "";
        if (errCode === "PGRST204" || errCode === "42703" || errMsg.includes("column") || errMsg.includes("notes")) {
          setMemoError("Run migration SQL to enable notes (see OPS.md)");
        } else {
          setMemoError(`Save failed: ${errMsg.slice(0, 40)}`);
        }
        setMemoSaveStatus("error");
        setTimeout(() => {
          setMemoError(null);
          setMemoSaveStatus(null);
        }, 5000);
        return;
      }

      card.notes = text || null; // Update local state
      setMemoSaveStatus("saved");
      setTimeout(() => setMemoSaveStatus(null), 2000);
    } catch (e) {
      setMemoError("Network error");
      setMemoSaveStatus("error");
      setTimeout(() => {
        setMemoError(null);
        setMemoSaveStatus(null);
      }, 5000);
    }
  };

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setMemoText(newText);
    setMemoSaveStatus(null);
    setMemoError(null);

    // Clear existing timeout
    if (memoSaveTimeout.current) {
      clearTimeout(memoSaveTimeout.current);
    }

    // Debounce save by 500ms
    memoSaveTimeout.current = setTimeout(() => {
      handleMemoSave(newText);
    }, 500);
  };

  const handleMemoModalClose = () => {
    // Flush pending save immediately
    if (memoSaveTimeout.current) {
      clearTimeout(memoSaveTimeout.current);
      handleMemoSave(memoText);
    }
    setShowMemoModal(false);
  };

  const imageContent = (
    <div style={{ aspectRatio: "7/4", overflow: "hidden", position: "relative" }}>
      {showImage ? (
        <img
          src={imgSrc!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (displayImage && proxiedUrl !== displayImage) {
              // First failure on this image: retry via proxy
              dbg("img_proxy", { url: displayImage });
              setProxiedUrl(displayImage);
              return;
            }
            // Proxy also failed — fall through to next source
            setProxiedUrl(null);
            if (hasRealImage) {
              dbg("img_error", { type: "saved", url: card.image_url });
              setRealImgFailed(true);
            } else {
              dbg("img_error", { type: "preview", url: displayImage });
              setPreviewFailed(true);
            }
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <>
          {svgFallbacks[card.card_type] || svgFallbacks.memo}
          <span
            style={{
              position: "absolute",
              bottom: 6,
              right: 8,
              fontSize: 9,
              color: ct.accent,
              opacity: 0.5,
              fontFamily: "var(--font-dm)",
              letterSpacing: "0.05em",
            }}
          >
            auto / generated
          </span>
        </>
      )}
      {showImage && (
        <span
          style={{
            position: "absolute",
            bottom: 6,
            right: 8,
            fontSize: 9,
            color: "#fff",
            background: "rgba(0,0,0,0.3)",
            padding: "1px 6px",
            borderRadius: 4,
            fontFamily: "var(--font-dm)",
            letterSpacing: "0.05em",
          }}
        >
          {isProxied ? "proxy" : hasRealImage ? card.image_source : "preview"}
        </span>
      )}
    </div>
  );

  return (
    <div
      ref={(node) => {
        cardRef.current = node;
        setNodeRef(node);
      }}
      className="thought-card"
      style={{
        width: 210,
        minWidth: 210,
        borderRadius: 16,
        border: `1.5px solid ${ct.border}`,
        background: ct.bg,
        overflow: "hidden",
        cursor: isDraggable ? "grab" : "default",
        position: "relative",
        animationName: "cardPop",
        animationDuration: "0.45s",
        animationTimingFunction: "ease-out",
        animationFillMode: "both",
        animationDelay: `${index * 0.04}s`,
        ...dragStyle,
      }}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.transform = dragStyle.transform || "translateY(-4px)";
          e.currentTarget.style.boxShadow =
            "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)";
          setShowDelete(true);
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.transform = dragStyle.transform || "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
          setShowDelete(false);
        }
      }}
    >
      {/* Pin button */}
      {card.pinned !== null && (
        <button
          onClick={handlePinToggle}
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: pinError ? "1px solid #D93025" : "none",
            background: isPinned ? "rgba(255,215,0,0.9)" : "rgba(0,0,0,0.3)",
            color: isPinned ? "#000" : "#fff",
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            lineHeight: 1,
            transition: "all 0.2s",
          }}
          title={isPinned ? "Unpin" : "Pin"}
        >
          {isPinned ? "⭐" : "☆"}
        </button>
      )}

      {/* Delete button */}
      {showDelete && (
        <button
          onClick={() => onDelete(card.id)}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.4)",
            color: "#fff",
            fontSize: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            lineHeight: 1,
          }}
        >
          x
        </button>
      )}

      {/* Image Area — clickable if card has URL */}
      {cardUrl ? (
        <a
          href={cardUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", cursor: "pointer" }}
        >
          {imageContent}
        </a>
      ) : (
        imageContent
      )}

      {/* Text */}
      <div style={{ padding: "10px 14px 12px" }}>
        {/* Title - compact 2-line clamp, editable on click */}
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            style={{
              width: "100%",
              fontSize: 13,
              fontWeight: 600,
              color: "#2a2a2a",
              border: "1px solid #D9A441",
              borderRadius: 4,
              padding: "4px 6px",
              marginBottom: 4,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        ) : (
          <div
            onClick={handleTitleClick}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#2a2a2a",
              marginBottom: siteName ? 2 : 0,
              cursor: card.title !== undefined ? "pointer" : "default",
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.4,
            }}
            title={card.title !== undefined ? "Click to edit title" : undefined}
          >
            {displayTitle}
          </div>
        )}

        {/* Site name - subtle, single line */}
        {siteName && (
          <div
            style={{
              fontSize: 9,
              color: "#aaa",
              marginBottom: 4,
              fontFamily: "var(--font-dm)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {siteName}
          </div>
        )}

        {/* Title error message */}
        {titleError && (
          <div
            style={{
              fontSize: 9,
              color: "#D93025",
              background: "#FEE",
              padding: "4px 6px",
              borderRadius: 4,
              marginTop: 6,
              fontFamily: "var(--font-dm)",
              lineHeight: 1.3,
            }}
          >
            {titleError}
          </div>
        )}

        {/* Pin error message */}
        {pinErrorMsg && (
          <div
            style={{
              fontSize: 9,
              color: "#D93025",
              background: "#FEE",
              padding: "4px 6px",
              borderRadius: 4,
              marginTop: 6,
              fontFamily: "var(--font-dm)",
              lineHeight: 1.3,
            }}
          >
            {pinErrorMsg}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
          {/* MEMO pill with hover preview */}
          <div style={{ position: "relative" }}>
            <span
              onClick={() => {
                if (card.notes !== undefined) setShowMemoModal(true);
              }}
              onMouseEnter={() => {
                if (card.notes && card.notes.trim()) setShowMemoPreview(true);
              }}
              onMouseLeave={() => setShowMemoPreview(false)}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: ct.accent,
                background: `${ct.border}33`,
                padding: "2px 8px",
                borderRadius: 999,
                fontFamily: "var(--font-dm)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                cursor: card.notes !== undefined ? "pointer" : "default",
              }}
              title={card.notes !== undefined ? "Click to add/edit notes" : undefined}
            >
              {card.card_type}
            </span>

            {/* Memo preview bubble on hover */}
            {showMemoPreview && card.notes && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 4px)",
                  left: 0,
                  background: "rgba(0,0,0,0.85)",
                  color: "#fff",
                  padding: "6px 10px",
                  borderRadius: 6,
                  fontSize: 10,
                  lineHeight: 1.4,
                  maxWidth: 180,
                  zIndex: 10,
                  pointerEvents: "none",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-dm)",
                }}
              >
                {card.notes.slice(0, 120)}
                {card.notes.length > 120 ? "..." : ""}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
            {cardUrl && (
              <a
                href={cardUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: ct.accent,
                  textDecoration: "none",
                  fontFamily: "var(--font-dm)",
                  fontWeight: 600,
                  opacity: 0.7,
                }}
              >
                Open &rsaquo;
              </a>
            )}
          </div>
        </div>

        {isDebugPreview() && cardUrl && (
          <div style={{ fontSize: 8, color: "#aaa", fontFamily: "monospace", marginTop: 2 }}>
            preview: {debugSource}
          </div>
        )}
      </div>

      {/* Memo Modal */}
      {showMemoModal && (
        <div
          onClick={handleMemoModalClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              maxWidth: 500,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#2a2a2a",
                  marginBottom: 4,
                  wordBreak: "break-word",
                }}
              >
                {displayTitle}
              </div>
              <div style={{ fontSize: 11, color: "#999", fontFamily: "var(--font-dm)" }}>
                {new Date(card.created_at).toLocaleString()}
              </div>
            </div>

            {/* Open link */}
            {cardUrl && (
              <a
                href={cardUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  color: ct.accent,
                  textDecoration: "none",
                  fontFamily: "var(--font-dm)",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                Open link &rsaquo;
              </a>
            )}

            {/* Memo textarea */}
            <textarea
              value={memoText}
              onChange={handleMemoChange}
              placeholder="Add notes..."
              style={{
                width: "100%",
                minHeight: 180,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.6,
                color: "#2a2a2a",
                border: "1.5px solid #ddd",
                borderRadius: 8,
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = ct.accent;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#ddd";
              }}
            />

            {/* Save status */}
            {memoSaveStatus === "saved" && (
              <div
                style={{
                  fontSize: 11,
                  color: "#2D8F50",
                  marginTop: 8,
                  fontFamily: "var(--font-dm)",
                }}
              >
                ✓ Saved
              </div>
            )}

            {/* Error message */}
            {memoError && (
              <div
                style={{
                  fontSize: 11,
                  color: "#D93025",
                  background: "#FEE",
                  padding: "6px 10px",
                  borderRadius: 6,
                  marginTop: 8,
                  fontFamily: "var(--font-dm)",
                  lineHeight: 1.4,
                }}
              >
                {memoError}
              </div>
            )}

            {/* Close button */}
            <button
              onClick={handleMemoModalClose}
              style={{
                marginTop: 16,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: ct.accent,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "var(--font-dm)",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

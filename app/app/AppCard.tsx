"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKETS } from "@/lib/supabase/constants";
import { getCardType } from "@/lib/cardTypes";
import { extractFirstHttpUrl, getYouTubeThumbnail } from "@/lib/urlUtils";
import type { Card, File as FileRecord } from "@/lib/supabase/types";
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
  onFileAssign?: (cardId: string, fileId: string | null) => void;
  onUpdate?: (cardId: string) => void;
  files?: FileRecord[];
  isDraggable?: boolean;
  isBulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (cardId: string) => void;
}

export default function AppCard({ card, index, onDelete, onPinToggle, onFileAssign, onUpdate, files = [], isDraggable = false, isBulkMode = false, isSelected = false, onToggleSelect }: AppCardProps) {
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
  const [ytQualityIndex, setYtQualityIndex] = useState(0); // 0=maxres, 1=sd, 2=hq, 3=mq, 4=default
  const [ytThumbFailed, setYtThumbFailed] = useState(false); // Separate flag for YouTube thumb failures
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
  const [isHovered, setIsHovered] = useState(false);
  const [showFileSelect, setShowFileSelect] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const memoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Determine URL from multiple sources (source_url > text > preview_image_url)
  const cardUrl = (() => {
    if (card.source_url) return card.source_url;
    const textUrl = extractFirstHttpUrl(card.text);
    if (textUrl) return textUrl;
    // Fallback: if preview_image_url looks like a YouTube page URL, use it
    if (card.preview_image_url && (
      card.preview_image_url.includes("youtube.com/") ||
      card.preview_image_url.includes("youtu.be/")
    )) {
      return card.preview_image_url;
    }
    return null;
  })();
  const hasRealImage = !!(card.image_url && card.image_source !== "generated" && !realImgFailed);

  // Derive display title: prefer card.title, fallback to first line of text
  const displayTitle = card.title || card.text.split("\n")[0];
  const siteName = card.site_name || null;

  // Extract body text (everything after first line if title exists)
  const bodyText = card.title
    ? card.text.split("\n").slice(1).join("\n").trim()
    : card.text.split("\n").slice(1).join("\n").trim();
  const hasBodyText = bodyText.length > 0;

  // Image priority: media_thumb_path > preview_image_url > image_url > link-preview chain
  const hasMediaThumb = !!(card.media_thumb_path && !realImgFailed);
  // Reject YouTube logo assets as invalid preview_image_url
  const isYouTubeLogo = card.preview_image_url && (
    card.preview_image_url.includes("youtube.com/img/desktop/yt_") ||
    card.preview_image_url.includes("youtube.com/yts/img/")
  );
  const hasPreviewImageUrl = !!(card.preview_image_url && !realImgFailed && !isYouTubeLogo);

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

  // Backfill source_url for YouTube cards (one-time client-side fix for legacy data)
  useEffect(() => {
    if (!isVisible || card.source_url || !cardUrl) return;
    // Only backfill if cardUrl is YouTube and was extracted from text
    const textUrl = extractFirstHttpUrl(card.text);
    if (textUrl && textUrl === cardUrl && getYouTubeThumbnail(cardUrl)) {
      // Debounce: wait 2s after render to avoid spamming on initial load
      const timer = setTimeout(async () => {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          await supabase
            .from("cards")
            .update({ source_url: cardUrl })
            .eq("id", card.id);
          dbg("backfill", { cardId: card.id, source_url: cardUrl });
        } catch (err) {
          // Best-effort, fail silently
          console.warn("source_url backfill failed:", err);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, card.id, card.source_url, card.text, cardUrl]);

  // Lazy-fetch link preview — only when visible and no media_thumb_path
  useEffect(() => {
    if (!isVisible || hasMediaThumb || hasRealImage || !cardUrl) return;
    dbg("url", { cardId: card.id, url: cardUrl });

    // YouTube: ALWAYS derive thumbnail from videoId (override preview_image_url if present)
    // Start with hq (always available) instead of maxres (sometimes 404)
    const qualities: Array<"hq" | "mq" | "default"> = ["hq", "mq", "default"];
    const ytThumb = getYouTubeThumbnail(cardUrl, qualities[ytQualityIndex]);
    if (ytThumb && !ytThumbFailed) {
      dbg("source", { url: cardUrl, source: "youtube", quality: qualities[ytQualityIndex] });
      setPreviewImg(ytThumb);
      return;
    }

    // If preview_image_url exists and NOT YouTube, use it
    if (hasPreviewImageUrl) {
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
  }, [card.id, cardUrl, hasMediaThumb, hasPreviewImageUrl, hasRealImage, isVisible, ytQualityIndex]);

  // Get Supabase Storage public URL for media thumbnail
  const getMediaThumbUrl = () => {
    if (!card.media_thumb_path) return null;
    const supabase = createClient();
    const { data } = supabase.storage.from(STORAGE_BUCKETS.CARDS_MEDIA).getPublicUrl(card.media_thumb_path);
    return data?.publicUrl || null;
  };

  // Get Supabase Storage public URL for media original (video playback)
  const getMediaOriginalUrl = () => {
    if (!card.media_path) return null;
    const supabase = createClient();
    const { data } = supabase.storage.from(STORAGE_BUCKETS.CARDS_MEDIA).getPublicUrl(card.media_path);
    return data?.publicUrl || null;
  };

  // Check if this card is a video
  const isVideoCard = card.media_kind === "video" && !!card.media_path;

  // Image priority: media_thumb_path > preview_image_url > image_url > link-preview chain
  // BUT: For YouTube, ALWAYS use computed thumbnail (never trust preview_image_url)
  const isYouTubeUrl = cardUrl && getYouTubeThumbnail(cardUrl) !== null;
  const youtubeComputedThumb = isYouTubeUrl && !ytThumbFailed
    ? getYouTubeThumbnail(cardUrl, ["hq", "mq", "default"][ytQualityIndex] as "hq" | "mq" | "default")
    : null;

  const displayImage = hasMediaThumb
    ? getMediaThumbUrl()!
    : youtubeComputedThumb // YouTube: use computed thumbnail (override preview_image_url)
    ? youtubeComputedThumb
    : hasPreviewImageUrl
    ? card.preview_image_url!
    : hasRealImage
    ? card.image_url!
    : previewFailed
    ? null
    : previewImg;
  const showImage = !!displayImage;
  const isProxied = !!proxiedUrl && proxiedUrl === displayImage;

  // When proxied, route through same-origin image proxy (bypasses hotlink 403s)
  const imgSrc = isProxied
    ? `/api/image-proxy?url=${encodeURIComponent(displayImage!)}${cardUrl ? `&ref=${encodeURIComponent(cardUrl)}` : ""}`
    : displayImage;

  const debugSource = !cardUrl
    ? "none"
    : !showImage
    ? "svg"
    : isProxied
    ? "proxy"
    : hasMediaThumb
    ? "media"
    : hasRealImage
    ? "saved"
    : getYouTubeThumbnail(cardUrl)
    ? "youtube"
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

  const handleAIAnalyze = async () => {
    setAiAnalyzing(true);
    setAiError(null);

    try {
      const supabase = createClient();
      const response = await fetch("/api/ai-organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id }),
      });

      if (!response.ok) {
        const status = response.status;

        // Try to parse response as JSON, fallback to text, then null
        let errorData: any = null;
        let errorText: string | null = null;
        try {
          errorData = await response.json();
        } catch {
          try {
            errorText = await response.text();
          } catch {
            // Response body unreadable
          }
        }

        // 400: Bad request (validation errors)
        if (status === 400) {
          if (errorData?.error === "cardId required") {
            throw new Error("AI request invalid (cardId required)");
          }
          // Other 400 errors: extract message or use generic
          const msg = errorData?.error?.message || errorData?.error || `Bad request (HTTP 400)`;
          const errorMsg = typeof msg === 'string' ? msg : `Bad request (HTTP 400)`;
          throw new Error(errorMsg);
        }

        // 404: Check if endpoint missing (HTML response) vs card not found (JSON)
        if (status === 404) {
          if (errorData?.error?.code === "CARD_NOT_FOUND" || errorData?.error === "Card not found") {
            throw new Error("Card not found - may have been deleted");
          }
          // Endpoint missing (got HTML or no JSON error.code)
          throw new Error("AI endpoint unavailable (404) - check deployment");
        }

        // Other errors: extract message from JSON, text snippet, or generic fallback
        let errorMsg = `AI analysis failed (HTTP ${status})`;

        if (errorData?.error?.message) {
          errorMsg = errorData.error.message;
        } else if (errorData?.error) {
          errorMsg = typeof errorData.error === 'string' ? errorData.error : errorMsg;
        } else if (errorText) {
          // Sanitize text snippet (remove HTML tags, limit length)
          const sanitized = errorText.replace(/<[^>]*>/g, '').trim().slice(0, 120);
          if (sanitized) errorMsg = sanitized;
        }

        throw new Error(errorMsg);
      }

      // Reload card data to show updated AI fields
      const { data: updated } = await supabase
        .from("cards")
        .select("ai_summary, ai_tags, ai_action")
        .eq("id", card.id)
        .single();

      if (updated) {
        // Update parent component (trigger re-render)
        if (onUpdate) onUpdate(card.id);

        // Show success feedback
        setAiSuccess(true);
        setTimeout(() => setAiSuccess(false), 2000);

        // Scroll card into view after update to ensure it stays visible
        setTimeout(() => {
          cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 100);
      }

      // Show success briefly
      setTimeout(() => setAiAnalyzing(false), 1500);
    } catch (error: any) {
      // Always show error, even if message is missing (trim to catch empty strings)
      const errorMsg = error?.message?.trim() || "AI analysis failed (unknown error)";
      setAiError(errorMsg);
      setAiAnalyzing(false);
      // Persist error for 5 seconds (was 3s) to ensure visibility
      setTimeout(() => setAiError(null), 5000);
    } finally {
      // Guarantee analyzing state is cleared even if catch fails
      setAiAnalyzing(false);
    }
  };

  const imageContent = (
    <div style={{ aspectRatio: "7/4", overflow: "hidden", position: "relative" }}>
      {isVideoCard ? (
        <video
          controls
          playsInline
          preload="metadata"
          poster={showImage && imgSrc ? imgSrc : undefined}
          src={getMediaOriginalUrl() || undefined}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "#000",
          }}
        />
      ) : showImage ? (
        <img
          src={imgSrc!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            // YouTube quality fallback: hq → mq → default (avoid maxres 404s)
            if (cardUrl && getYouTubeThumbnail(cardUrl)) {
              const qualities: Array<"hq" | "mq" | "default"> = ["hq", "mq", "default"];
              if (ytQualityIndex < qualities.length - 1) {
                const nextIndex = ytQualityIndex + 1;
                dbg("img_error", {
                  type: "youtube_quality_fallback",
                  from: qualities[ytQualityIndex],
                  to: qualities[nextIndex],
                });
                setYtQualityIndex(nextIndex);
                return;
              } else {
                // All YouTube qualities failed, mark as failed
                dbg("img_error", { type: "youtube_all_qualities_failed" });
                setYtThumbFailed(true);
              }
            }

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

  const handleCardClick = () => {
    if (isBulkMode && onToggleSelect) {
      onToggleSelect(card.id);
    }
  };

  return (
    <div
      ref={(node) => {
        cardRef.current = node;
        setNodeRef(node);
      }}
      className="thought-card"
      onClick={handleCardClick}
      style={{
        width: 210,
        minWidth: 210,
        borderRadius: 16,
        border: `1.5px solid ${isSelected ? "#4F6ED9" : ct.border}`,
        background: isSelected ? "#EEF2FF" : ct.bg,
        overflow: "hidden",
        cursor: isBulkMode ? "pointer" : (isDraggable ? "grab" : "default"),
        position: "relative",
        animationName: "cardPop",
        animationDuration: "0.45s",
        animationTimingFunction: "ease-out",
        animationFillMode: "both",
        animationDelay: `${index * 0.04}s`,
        ...dragStyle,
      }}
      {...(isDraggable && !isBulkMode ? { ...attributes, ...listeners } : {})}
      onMouseEnter={(e) => {
        if (!isDragging && !isBulkMode) {
          e.currentTarget.style.transform = dragStyle.transform || "translateY(-4px)";
          e.currentTarget.style.boxShadow =
            "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)";
          setShowDelete(true);
          setIsHovered(true);
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging && !isBulkMode) {
          e.currentTarget.style.transform = dragStyle.transform || "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
          setShowDelete(false);
          setIsHovered(false);
        }
      }}
    >
      {/* Bulk mode checkbox */}
      {isBulkMode && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            width: 24,
            height: 24,
            borderRadius: 4,
            border: `2px solid ${isSelected ? "#4F6ED9" : "#ddd"}`,
            background: isSelected ? "#4F6ED9" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {isSelected && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L5.5 10.5L12 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}

      {/* Hover text preview (full title + body snippet) */}
      {isHovered && hasBodyText && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "rgba(0,0,0,0.9)",
            color: "#fff",
            padding: "12px 14px",
            borderRadius: 8,
            zIndex: 20,
            pointerEvents: "none",
            maxWidth: 280,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
          className="hover-text-preview"
        >
          {/* Full title */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
              lineHeight: 1.4,
            }}
          >
            {displayTitle}
          </div>

          {/* Body snippet (6-8 lines max) */}
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: "#ddd",
              display: "-webkit-box",
              WebkitLineClamp: 8,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {bodyText}
          </div>
        </div>
      )}

      {/* Pin button */}
      {card.pinned !== null && !isBulkMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePinToggle();
          }}
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
      {showDelete && !isBulkMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(card.id);
          }}
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
      {cardUrl && !isBulkMode ? (
        <a
          href={cardUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
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
            title={displayTitle}
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
              onClick={(e) => {
                if (isBulkMode) {
                  e.stopPropagation();
                  return;
                }
                if (card.notes !== undefined) {
                  e.stopPropagation();
                  setShowMemoModal(true);
                }
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
            {/* Created date - always visible */}
            <span
              style={{
                fontSize: 9,
                color: "#aaa",
                fontFamily: "var(--font-dm)",
              }}
              title={new Date(card.created_at).toLocaleString()}
            >
              {new Intl.DateTimeFormat("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(card.created_at))}
            </span>

            {/* AI organize button - always visible for discoverability */}
            {!isBulkMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAIAnalyze();
                }}
                disabled={aiAnalyzing}
                data-testid="ai-button"
                aria-label="AI"
                style={{
                  fontSize: 9,
                  color: aiAnalyzing ? "#999" : "#7B4FD9",
                  background: card.ai_summary ? "#F5F0FF" : "transparent",
                  border: card.ai_summary ? "1px solid #BBA0F5" : "none",
                  borderRadius: 4,
                  padding: "2px 6px",
                  cursor: aiAnalyzing ? "default" : "pointer",
                  fontFamily: "var(--font-dm)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                title={card.ai_summary ? `AI: ${card.ai_summary}` : "Analyze with AI"}
              >
                {aiAnalyzing ? "..." : card.ai_summary ? "AI ✓" : "AI"}
              </button>
            )}

            {/* AI error - always visible, accessible */}
            {aiError && (
              <span
                data-testid="ai-feedback"
                role="alert"
                aria-live="polite"
                style={{
                  fontSize: 8,
                  color: "#D93025",
                  fontFamily: "var(--font-dm)",
                }}
              >
                {aiError}
              </span>
            )}

            {/* AI success */}
            {aiSuccess && (
              <span
                style={{
                  fontSize: 8,
                  color: "#1E8E3E",
                  fontFamily: "var(--font-dm)",
                }}
              >
                AI updated
              </span>
            )}

            {/* File assignment */}
            {onFileAssign && files.length > 0 && !isBulkMode && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFileSelect(!showFileSelect);
                  }}
                  style={{
                    fontSize: 9,
                    color: "#888",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-dm)",
                    padding: 0,
                  }}
                  title="Move to file"
                >
                  📁
                </button>

                {showFileSelect && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 4px)",
                      right: 0,
                      background: "#fff",
                      border: "1px solid #ddd",
                      borderRadius: 6,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 15,
                      minWidth: 120,
                      maxHeight: 180,
                      overflow: "auto",
                    }}
                  >
                    <div
                      onClick={() => {
                        onFileAssign(card.id, null);
                        setShowFileSelect(false);
                      }}
                      style={{
                        padding: "6px 10px",
                        fontSize: 11,
                        cursor: "pointer",
                        borderBottom: "1px solid #eee",
                        fontFamily: "var(--font-dm)",
                        background: !card.file_id ? "#f5f5f5" : "transparent",
                      }}
                    >
                      Unfile
                    </div>
                    {files.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => {
                          onFileAssign(card.id, file.id);
                          setShowFileSelect(false);
                        }}
                        style={{
                          padding: "6px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "var(--font-dm)",
                          background: card.file_id === file.id ? "#f5f5f5" : "transparent",
                          wordBreak: "break-word",
                        }}
                      >
                        {file.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {cardUrl && !isBulkMode && (
              <a
                href={cardUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
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

"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKETS } from "@/lib/supabase/constants";
import { getCardType } from "@/lib/cardTypes";
import { extractFirstHttpUrl, getYouTubeThumbnail } from "@/lib/urlUtils";
import type { Card, File as FileRecord } from "@/lib/supabase/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Drawer } from "@/ui/subframe/components/Drawer";

type PreviewCacheEntry = {
  status: "ok" | "fail";
  value: string | null;
  ts: number;
  retryAfterMs: number;
};

type PreviewSource = "direct" | "proxy";
type PreviewState = {
  source: PreviewSource;
  triedDirect: boolean;
  triedProxy: boolean;
  failed: boolean;
  lastErrorAt?: number;
};

const MAX_PREVIEW_ATTEMPTS = 2;

// Module-level preview cache with retry timing for negative results.
const previewCache = new Map<string, PreviewCacheEntry>();

// Instagram CDN domains — images from these hosts should be rendered with <img>
// (not Next/Image) to avoid remotePatterns restrictions on CDN subdomains.
function isInstagramCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const h = new URL(url).hostname;
    return h.endsWith(".cdninstagram.com") || h.endsWith(".fbcdn.net");
  } catch {
    return false;
  }
}

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

const CHIP_BASE_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  fontFamily: "var(--font-dm)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const CHIP_TYPE_STYLE = (accent: string, border: string): React.CSSProperties => ({
  ...CHIP_BASE_STYLE,
  color: accent,
  background: `${border}33`,
  borderColor: "transparent",
});

const CHIP_ACTION_NEUTRAL_STYLE: React.CSSProperties = {
  ...CHIP_BASE_STYLE,
  color: "#404040",
  background: "#fff",
  borderColor: "#d4d4d4",
};

interface AppCardProps {
  card: Card;
  index: number;
  onDelete: (id: string) => void;
  onPinToggle?: (id: string, newPinned: boolean) => void;
  onFileAssign?: (cardId: string, fileId: string | null) => void;
  onUpdate?: (cardId: string) => void;
  onNotesSaved?: (cardId: string, notes: string | null) => void;
  files?: FileRecord[];
  isDraggable?: boolean;
  isBulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (cardId: string) => void;
}

export default function AppCard({ card, index, onDelete, onPinToggle, onFileAssign, onUpdate, onNotesSaved, files = [], isDraggable = false, isBulkMode = false, isSelected = false, onToggleSelect }: AppCardProps) {
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
  const [previewState, setPreviewState] = useState<PreviewState>({
    source: "direct",
    triedDirect: false,
    triedProxy: false,
    failed: false,
  });
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
  const memoTextareaRef = useRef<HTMLTextAreaElement>(null);
  const memoTriggerRef = useRef<HTMLButtonElement>(null);
  const previewAttemptCountRef = useRef(0);
  const memoStorageKey = `card:memo:${card.id}`;

  const persistMemoLocal = (text: string) => {
    try {
      if (text.trim()) {
        localStorage.setItem(memoStorageKey, text);
      } else {
        localStorage.removeItem(memoStorageKey);
      }
    } catch {
      // Ignore storage errors (private mode / quota)
    }
  };

  const readMemoLocal = () => {
    try {
      return localStorage.getItem(memoStorageKey);
    } catch {
      return null;
    }
  };

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
  const memoSnippet = (memoText || card.notes || "").trim();

  // Image priority: media_thumb_path > preview_image_url > image_url > link-preview chain
  const hasMediaThumb = !!(card.media_thumb_path && !realImgFailed);
  // Reject YouTube logo assets as invalid preview_image_url
  const isYouTubeLogo = card.preview_image_url && (
    card.preview_image_url.includes("youtube.com/img/desktop/yt_") ||
    card.preview_image_url.includes("youtube.com/yts/img/")
  );
  const hasPreviewImageUrl = !!(
    card.preview_image_url &&
    !realImgFailed &&
    !isYouTubeLogo &&
    !previewState.failed
  );

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

  useEffect(() => {
    const localRaw = readMemoLocal();
    const dbRaw = typeof card.notes === "string" ? card.notes : "";
    const local = localRaw?.trim() ?? "";
    const db = dbRaw.trim();
    const resolved = local.length > 0 ? localRaw! : (db.length > 0 ? dbRaw : "");
    setMemoText(resolved);
  }, [card.id, card.notes]);

  useEffect(() => {
    setPreviewState({
      source: "direct",
      triedDirect: false,
      triedProxy: false,
      failed: false,
    });
    previewAttemptCountRef.current = 0;
    setPreviewFailed(false);
  }, [card.id, card.preview_image_url]);

  // Auto-focus textarea when memo drawer opens (Drawer handles scroll lock + focus trap)
  useEffect(() => {
    if (!showMemoModal) return;
    const t = setTimeout(() => memoTextareaRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [showMemoModal]);

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
    // Start with maxres (best quality), fallback through sd → hq → mq → default on 404
    const qualities: Array<"maxres" | "sd" | "hq" | "mq" | "default"> = ["maxres", "sd", "hq", "mq", "default"];
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
    if (cached) {
      const age = Date.now() - cached.ts;
      if (cached.status === "ok") {
        dbg("cache_hit", { url: cardUrl, hasImage: !!cached.value });
        setPreviewImg(cached.value);
        return;
      }
      if (age < cached.retryAfterMs) {
        dbg("cache_skip_retry", { url: cardUrl, retryAfterMs: cached.retryAfterMs, age });
        setPreviewImg(null);
        return;
      }
      previewCache.delete(cardUrl);
    }

    // Fetch from link-preview API
    const controller = new AbortController();
    const t0 = performance.now();
    const debugParam = isDebugPreview() ? "&debug=1" : "";
    fetch(`/api/link-preview?url=${encodeURIComponent(cardUrl)}${debugParam}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        dbg("fetch", { url: cardUrl, status: r.status, ms: Math.round(performance.now() - t0) });
        if (!r.ok) {
          return { image: null, retryAfterMs: 5 * 60 * 1000 };
        }
        const data = await r.json();
        return data;
      })
      .then((data) => {
        const image = data?.image ?? null;
        const retryAfterMs = typeof data?.retryAfterMs === "number"
          ? data.retryAfterMs
          : image
          ? 24 * 60 * 60 * 1000
          : 5 * 60 * 1000;
        previewCache.set(cardUrl, {
          status: image ? "ok" : "fail",
          value: image,
          ts: Date.now(),
          retryAfterMs,
        });
        dbg("source", { url: cardUrl, source: image ? "api" : "none" });
        if (!controller.signal.aborted) {
          setPreviewImg(image);
          // Persist Instagram thumbnail to preview_image_url so it survives page reload
          if (image && isInstagramCdnUrl(image) && !card.preview_image_url) {
            try {
              import("@/lib/supabase/client").then(({ createClient }) => {
                createClient()
                  .from("cards")
                  .update({ preview_image_url: image })
                  .eq("id", card.id)
                  .then(() => {});
              });
            } catch {
              // Best-effort — ignore DB errors
            }
          }
        }
      })
      .catch(() => {
        previewCache.set(cardUrl, {
          status: "fail",
          value: null,
          ts: Date.now(),
          retryAfterMs: 5 * 60 * 1000,
        });
      });
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
    ? getYouTubeThumbnail(cardUrl, (["maxres", "sd", "hq", "mq", "default"] as const)[ytQualityIndex])
    : null;

  const previewImageUrl = hasPreviewImageUrl ? card.preview_image_url! : null;

  const displayImage = hasMediaThumb
    ? getMediaThumbUrl()!
    : youtubeComputedThumb // YouTube: use computed thumbnail (override preview_image_url)
    ? youtubeComputedThumb
    : previewImageUrl
    ? previewImageUrl
    : hasRealImage
    ? card.image_url!
    : previewFailed
    ? null
    : previewImg;
  const showImage = !!displayImage;
  const isProxied =
    !!previewImageUrl &&
    previewState.source === "proxy" &&
    displayImage === previewImageUrl;

  // Instagram CDN images are routed through image-proxy with IG-specific headers
  // (Referer: https://www.instagram.com/, browser UA) to bypass CDN referrer restrictions.
  const isIgCdnImage = isInstagramCdnUrl(displayImage);

  // When proxied, route through same-origin image proxy (bypasses hotlink 403s).
  // IG CDN images: proxy without ref — server auto-detects IG CDN host and adds IG headers.
  const imgSrc = isIgCdnImage
    ? `/api/image-proxy?url=${encodeURIComponent(displayImage!)}`
    : isProxied
    ? `/api/image-proxy?url=${encodeURIComponent(previewImageUrl!)}`
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
    const savedNotes = text || null;
    const saveLocalSuccess = () => {
      card.notes = savedNotes;
      persistMemoLocal(text);
      if (onNotesSaved) onNotesSaved(card.id, savedNotes);
      setMemoError(null);
      setMemoSaveStatus("saved");
      setTimeout(() => setMemoSaveStatus(null), 2000);
    };

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
          saveLocalSuccess();
          return;
        } else {
          setMemoError(`Save failed: ${errMsg.slice(0, 40)} (saved locally)`);
          saveLocalSuccess();
          return;
        }
      }

      saveLocalSuccess();
    } catch (e) {
      setMemoError("Network error (saved locally)");
      saveLocalSuccess();
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
    // Restore focus to trigger chip (Drawer doesn't track our custom trigger)
    setTimeout(() => memoTriggerRef.current?.focus(), 0);
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

        // Show success feedback (local + global)
        setAiSuccess(true);
        const successEvent = new CustomEvent("shinen:ai-feedback", { detail: "AI updated card" });
        window.dispatchEvent(successEvent);
        document.dispatchEvent(successEvent);
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
      // Dispatch to global event bus (both window and document) — ensures feedback even if card unmounts/re-renders
      const errorEvent = new CustomEvent("shinen:ai-feedback", { detail: errorMsg });
      window.dispatchEvent(errorEvent);
      document.dispatchEvent(errorEvent);
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
          alt={card.text ? card.text.slice(0, 80) : "Card image"}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            // YouTube quality fallback: maxres → sd → hq → mq → default
            if (cardUrl && getYouTubeThumbnail(cardUrl)) {
              const qualities: Array<"maxres" | "sd" | "hq" | "mq" | "default"> = ["maxres", "sd", "hq", "mq", "default"];
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

            if (previewImageUrl && !previewState.failed) {
              setPreviewState((prev) => {
                const nextAttempts = previewAttemptCountRef.current + 1;
                previewAttemptCountRef.current = nextAttempts;
                if (nextAttempts >= MAX_PREVIEW_ATTEMPTS) {
                  dbg("img_preview_stop", { url: previewImageUrl, attempts: nextAttempts });
                  return {
                    ...prev,
                    triedDirect: true,
                    triedProxy: true,
                    failed: true,
                    lastErrorAt: Date.now(),
                  };
                }
                if (prev.source === "direct" && !prev.triedProxy) {
                  dbg("img_proxy", { url: previewImageUrl });
                  return {
                    ...prev,
                    source: "proxy",
                    triedDirect: true,
                    triedProxy: true,
                    lastErrorAt: Date.now(),
                  };
                }
                return {
                  ...prev,
                  triedDirect: true,
                  triedProxy: true,
                  failed: true,
                  lastErrorAt: Date.now(),
                };
              });
              return;
            }
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
      {/* Source badge: platform icon overlay on thumbnail */}
      {showImage && cardUrl && (
        <span
          style={{
            position: "absolute",
            bottom: 6,
            right: 8,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: 4,
            background: "rgba(0,0,0,0.35)",
          }}
        >
          {isYouTubeUrl ? (
            <svg width="12" height="9" viewBox="0 0 24 17" fill="none">
              <path d="M23.5 2.5C23.2 1.4 22.3.5 21.2.2 19.3 0 12 0 12 0S4.7 0 2.8.3C1.7.5.8 1.4.5 2.5.2 4.4 0 8.5 0 8.5s.2 4.1.5 6c.3 1.1 1.2 2 2.3 2.3C4.7 17 12 17 12 17s7.3 0 9.2-.3c1.1-.3 2-1.2 2.3-2.3.3-1.9.5-6 .5-6s-.2-4.1-.5-5.9z" fill="#fff"/>
              <path d="M9.6 12.1l6.1-3.6-6.1-3.6v7.2z" fill="rgba(0,0,0,0.5)"/>
            </svg>
          ) : /instagram\.com|instagr\.am/i.test(cardUrl) ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
              <path d="M12 2.2c2.7 0 3 0 4.1.1 1 0 1.5.2 1.9.4.5.2.8.4 1.1.7.3.3.5.7.7 1.1.1.4.3.9.4 1.9 0 1.1.1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.5-.4 1.9-.2.5-.4.8-.7 1.1-.3.3-.7.5-1.1.7-.4.1-.9.3-1.9.4-1.1 0-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.5-.2-1.9-.4-.5-.2-.8-.4-1.1-.7-.3-.3-.5-.7-.7-1.1-.1-.4-.3-.9-.4-1.9 0-1.1-.1-1.4-.1-4.1s0-3 .1-4.1c0-1 .2-1.5.4-1.9.2-.5.4-.8.7-1.1.3-.3.7-.5 1.1-.7.4-.1.9-.3 1.9-.4 1.1 0 1.4-.1 4.1-.1zM12 0C9.3 0 8.9 0 7.9.1c-1.1 0-1.8.2-2.5.5-.7.3-1.3.6-1.9 1.2C2.9 2.4 2.6 3 2.3 3.6c-.3.7-.5 1.4-.5 2.5C1.7 7.1 1.7 7.5 1.7 12s0 4.9.1 5.9c0 1.1.2 1.8.5 2.5.3.7.6 1.3 1.2 1.9.6.6 1.2.9 1.9 1.2.7.3 1.4.5 2.5.5 1 .1 1.4.1 5.9.1s4.9 0 5.9-.1c1.1 0 1.8-.2 2.5-.5.7-.3 1.3-.6 1.9-1.2.6-.6.9-1.2 1.2-1.9.3-.7.5-1.4.5-2.5.1-1 .1-1.4.1-5.9s0-4.9-.1-5.9c0-1.1-.2-1.8-.5-2.5-.3-.7-.6-1.3-1.2-1.9C21.6 1.3 21 1 20.4.7c-.7-.3-1.4-.5-2.5-.5C16.9 0 16.5 0 12 0z"/>
              <path d="M12 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zm0 10.2a4 4 0 110-8 4 4 0 010 8z"/>
              <circle cx="18.4" cy="5.6" r="1.4"/>
            </svg>
          ) : null}
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
        background: `linear-gradient(to bottom, transparent 55%, rgba(${ct.accentRgb}, 0.07) 100%), ${isSelected ? "#EEF2FF" : ct.bg}`,
        overflow: "hidden",
        cursor: isBulkMode ? "pointer" : "default",
        position: "relative",
        boxShadow: "var(--card-slab-shadow, 0 1.8px 0 rgba(0,0,0,0.06), 0 0.9px 0 rgba(0,0,0,0.04))",
        animationName: "cardPop",
        animationDuration: "0.45s",
        animationTimingFunction: "ease-out",
        animationFillMode: "both",
        animationDelay: `${index * 0.04}s`,
        ...dragStyle,
      }}
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
      {/* DnD grip handle — visible on hover, handle-only drag */}
      {isDraggable && !isBulkMode && (
        <div
          {...listeners}
          {...attributes}
          data-testid="drag-handle"
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isDragging ? "grabbing" : "grab",
            opacity: isHovered || isDragging ? 0.7 : 0,
            transition: "opacity 0.15s",
            zIndex: 10,
            borderRadius: 4,
            background: "rgba(0,0,0,0.15)",
            color: "#fff",
            fontSize: 14,
            lineHeight: 1,
            touchAction: "none",
          }}
          aria-label="Drag to reorder"
        >
          ⠿
        </div>
      )}

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
          data-no-dnd="true"
          onPointerDownCapture={(e) => e.stopPropagation()}
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
          data-no-dnd="true"
          onPointerDownCapture={(e) => e.stopPropagation()}
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

        {memoSnippet && (
          <div
            data-testid="memo-snippet"
            style={{
              fontSize: 10,
              color: "#8a8a8a",
              marginTop: 4,
              lineHeight: 1.45,
              fontFamily: "var(--font-dm)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
            title={memoSnippet}
          >
            {memoSnippet}
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
            <button
              type="button"
              data-testid="chip-memo"
              data-no-dnd="true"
              className="card-chip"
              ref={memoTriggerRef}
              aria-label={`Open memo for ${displayTitle}`}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onClick={(e) => {
                if (isBulkMode) {
                  e.stopPropagation();
                  return;
                }
                e.stopPropagation();
                setShowMemoModal(true);
              }}
              onMouseEnter={() => {
                if ((card.notes && card.notes.trim()) || memoText.trim()) setShowMemoPreview(true);
              }}
              onMouseLeave={() => setShowMemoPreview(false)}
              style={{
                ...CHIP_TYPE_STYLE(ct.accent, ct.border),
                cursor: "pointer",
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && showMemoModal) {
                  e.preventDefault();
                  handleMemoModalClose();
                }
              }}
              title="Click to add/edit notes"
            >
              {card.card_type}
            </button>

            {/* Memo preview bubble on hover */}
            {showMemoPreview && (card.notes || memoText) && (
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
                {(card.notes || memoText).slice(0, 120)}
                {(card.notes || memoText).length > 120 ? "..." : ""}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
            {/* Created date - always visible, year included */}
            <span
              style={{
                fontSize: 9,
                color: "#aaa",
                fontFamily: "var(--font-dm)",
              }}
              title={new Date(card.created_at).toLocaleString()}
            >
              {new Intl.DateTimeFormat("ja-JP", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(card.created_at))}
            </span>

            {/* AI organize button - Phase0: hidden by default unless NEXT_PUBLIC_ENABLE_AI=1 */}
            {!isBulkMode && process.env.NEXT_PUBLIC_ENABLE_AI === "1" && (
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

            {/* AI error - Phase0: hidden unless NEXT_PUBLIC_ENABLE_AI=1 */}
            {aiError && process.env.NEXT_PUBLIC_ENABLE_AI === "1" && (
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

            {/* AI success - Phase0: hidden unless NEXT_PUBLIC_ENABLE_AI=1 */}
            {aiSuccess && process.env.NEXT_PUBLIC_ENABLE_AI === "1" && (
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

            {/* File assignment - clean pill button with icon + label */}
            {onFileAssign && files.length > 0 && !isBulkMode && (
              <div style={{ position: "relative" }}>
                <button
                  data-testid="chip-file"
                  data-no-dnd="true"
                  className="card-chip"
                  aria-haspopup="menu"
                  aria-expanded={showFileSelect}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFileSelect(!showFileSelect);
                  }}
                  style={{
                    ...CHIP_TYPE_STYLE(ct.accent, ct.border),
                    cursor: "pointer",
                  }}
                  title="Move to file"
                  aria-label="Move to file"
                >
                  FILE
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
          </div>
        </div>

      </div>

      {/* Memo Drawer (Subframe/Radix — handles overlay, focus trap, Escape, scroll lock) */}
      <Drawer open={showMemoModal} onOpenChange={(open) => { if (!open) handleMemoModalClose(); }}>
        <Drawer.Content className="w-[340px] max-w-[90vw] p-5" data-testid="memo-modal" role="dialog" aria-modal="true">
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            {/* Title */}
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#2a2a2a",
                marginBottom: 12,
                wordBreak: "break-word",
              }}
            >
              {displayTitle}
            </div>

            {/* Memo textarea — fills available space */}
            <textarea
              data-testid="memo-textarea"
              ref={memoTextareaRef}
              aria-label="Memo text"
              value={memoText}
              onChange={handleMemoChange}
              placeholder="Add notes..."
              style={{
                width: "100%",
                flex: 1,
                minHeight: 180,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.6,
                color: "#2a2a2a",
                border: "1.5px solid #ddd",
                borderRadius: 8,
                fontFamily: "inherit",
                resize: "vertical",
                overflowY: "auto",
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
              <div style={{ fontSize: 11, color: "#2D8F50", marginTop: 8, fontFamily: "var(--font-dm)" }}>
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

            {/* Footer — sticky bottom */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
              <button
                data-testid="memo-save"
                aria-label="Save memo"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2D8F50]"
                onClick={() => handleMemoSave(memoText)}
                style={{
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
                Save
              </button>
              <button
                aria-label="Close memo drawer"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#888888]"
                onClick={handleMemoModalClose}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#555",
                  background: "#f3f3f3",
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
        </Drawer.Content>
      </Drawer>
    </div>
  );
}

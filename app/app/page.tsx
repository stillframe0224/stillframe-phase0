"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured, getConfigStatus } from "@/lib/supabase/client";
import { STORAGE_BUCKETS } from "@/lib/supabase/constants";
import { cardTypes, getCardType } from "@/lib/cardTypes";
import { generateKeyBetween } from "@/lib/sortKey";
import { extractFirstHttpUrl } from "@/lib/urlUtils";
import type { Card, File as FileRecord } from "@/lib/supabase/types";
import AppCard from "./AppCard";
import AiFeedbackBus from "./AiFeedbackBus";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

const URL_REGEX = /https?:\/\/[^\s]+/;
const MANUAL_ORDER_SCHEMA = "v2";

function getManualOrderKey(userId: string): string {
  return `stillframe.manualOrder.${MANUAL_ORDER_SCHEMA}:${userId}`;
}

/**
 * Normalize external URLs from bookmarklet or user input
 * Handles: protocol-relative (//...), double-encoding (https%3A%2F%2F...), relative paths
 */
function normalizeExternalUrl(raw: string | null | undefined, baseUrl?: string): string | null {
  if (!raw) return null;

  let url = raw.trim();
  if (!url) return null;

  // Detect and decode double-encoded URLs (https%3A%2F%2F... → https://...)
  if (url.includes("%2F") || url.includes("%3A")) {
    try {
      const decoded = decodeURIComponent(url);
      // Only use decoded if it looks like a valid URL
      if (/^https?:\/\//.test(decoded) || /^\/\//.test(decoded)) {
        url = decoded;
      }
    } catch {
      // Malformed encoding, continue with original
    }
  }

  // Handle protocol-relative URLs (//example.com → https://example.com)
  if (url.startsWith("//")) {
    url = `https:${url}`;
  }

  // Handle relative paths (requires baseUrl)
  if (url.startsWith("/") && baseUrl) {
    try {
      url = new URL(url, baseUrl).href;
    } catch {
      return null;
    }
  }

  // Accept only http/https
  if (!/^https?:\/\//.test(url)) {
    return null;
  }

  return url.slice(0, 2000); // Cap length
}

function dedupeCards(cards: Card[]): Card[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function buildE2EMockCards(): Card[] {
  const now = Date.now();
  const types = ["memo", "idea", "quote", "task", "fragment", "dream"];
  return types.map((cardType, index) => {
    const createdAt = new Date(now - index * 60_000).toISOString();
    return {
      id: `e2e-card-${index + 1}`,
      user_id: "e2e-user",
      text: `E2E mock card ${index + 1}`,
      card_type: cardType,
      image_url: null,
      image_source: null,
      client_request_id: null,
      pinned: false,
      notes: null,
      source_url: null,
      site_name: null,
      preview_image_url: null,
      media_kind: null,
      media_path: null,
      media_thumb_path: null,
      media_mime: null,
      media_size: null,
      sort_key: null,
      file_id: null,
      ai_summary: null,
      ai_tags: null,
      ai_action: null,
      ai_model: null,
      ai_updated_at: null,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });
}

export default function AppPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const e2eMode =
    typeof window !== "undefined" &&
    (window as any).__E2E_ALLOWED__ === true &&
    new URLSearchParams(window.location.search).get("e2e") === "1";

  const [cards, setCards] = useState<Card[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [input, setInput] = useState("");
  const [selectedType, setSelectedType] = useState("memo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string; avatar_url?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Search/filter/sort state (initialized from URL query params)
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [fileFilter, setFileFilter] = useState<string>("all");
  const [mediaFilter, setMediaFilter] = useState<"all" | "link" | "image" | "video">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "custom">("newest");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [showAddHub, setShowAddHub] = useState(false);
  const [lastSavedCard, setLastSavedCard] = useState<{
    id: string;
    file_id?: string | null;
    media_kind?: string | null;
    created_at: string;
    pinned?: boolean;
  } | null>(null);
  const [lastAiUpdatedCard, setLastAiUpdatedCard] = useState<{
    id: string;
    file_id?: string | null;
    created_at: string;
  } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addHubRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const prefillAppliedRef = useRef(false);
  const autoSaveRanRef = useRef(false);
  const autoSaveInProgressRef = useRef(false);
  const filterInitializedRef = useRef(false);
  const initialQueryRef = useRef<URLSearchParams | null>(null);
  const bmConsumedRef = useRef(false);
  const cardsRef = useRef<Card[]>([]);
  const configured = isSupabaseConfigured() || e2eMode;

  // Capture initial query params synchronously during render (before any effects)
  if (typeof window !== "undefined" && initialQueryRef.current === null) {
    initialQueryRef.current = new URLSearchParams(window.location.search);
  }

  // Check if we have bookmarklet params (not yet consumed)
  const hasBmParams = !bmConsumedRef.current &&
    initialQueryRef.current?.has("auto") === true &&
    initialQueryRef.current?.has("url") === true;

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // Load user and cards
  useEffect(() => {
    if (e2eMode) {
      setUser({ id: "e2e-user", email: "e2e@example.com" });
      setCards(buildE2EMockCards());
      setFiles([]);
      setLoading(false);
      return;
    }
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const search = window.location.search;
        const loginUrl = search
          ? `/auth/login?next=${encodeURIComponent(`/app${search}`)}`
          : "/auth/login";
        window.location.href = loginUrl;
        return;
      }
      setUser({
        id: user.id,
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url,
      });

      const { data } = await supabase
        .from("cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setCards(dedupeCards(data));

      // Load files
      const { data: filesData } = await supabase
        .from("files")
        .select("*")
        .order("created_at", { ascending: false });
      if (filesData) setFiles(filesData);

      setLoading(false);
    }
    init();
  }, [configured, e2eMode]);

  // Prefill from query: /app?url=...&title=... (skip when auto=1, auto-save handles that)
  useEffect(() => {
    if (prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");
    if (!url || params.get("auto") === "1") return;
    const title = params.get("title") || "";
    setInput(title ? `${title}\n${url}` : url);
    window.history.replaceState({}, "", "/app");
  }, []);

  // Auto-save from bookmarklet: /app?auto=1&url=...&title=...&img=...&site=...&s=...
  useEffect(() => {
    if (autoSaveRanRef.current) return;
    if (loading || !user || !configured) return;
    if (!hasBmParams || !initialQueryRef.current) return;

    autoSaveRanRef.current = true;
    autoSaveInProgressRef.current = true;

    // Read from immutable initial query ref (captured during render)
    const params = initialQueryRef.current;
    const rawBmUrl = params.get("url")!;

    (async () => {
      // Normalize all external URLs
      const bmUrl = normalizeExternalUrl(rawBmUrl, rawBmUrl) || rawBmUrl;
      const title = (params.get("title") || "").slice(0, 200).trim();
      const selection = (params.get("s") || "").slice(0, 1200).trim();
      const rawPreviewImg = (params.get("img") || "").trim();
      const previewImg = normalizeExternalUrl(rawPreviewImg, bmUrl);
      const siteName = (params.get("site") || "").slice(0, 100).trim();

      // Text body: title\nurl + optional selection
      let text = title ? `${title}\n${bmUrl}` : bmUrl;
      if (selection) text += `\n\n${selection}`;

      // Deterministic requestId from URL+title (same input = same ID, prevents StrictMode dupes)
      let requestId: string;
      try {
        const encoded = new TextEncoder().encode(`${bmUrl}\n${title}`);
        const hash = await crypto.subtle.digest("SHA-256", encoded);
        const hex = Array.from(new Uint8Array(hash))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        requestId = `bm_${hex.slice(0, 32)}`;
      } catch {
        requestId = crypto.randomUUID();
      }

      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);

      let saved = false;
      try {
        const imageUrl = await fetchOgpImage(text);
        const imageSource: Card["image_source"] = imageUrl ? "ogp" : "generated";

        const supabase = createClient();
        const basePayload = {
          user_id: user.id,
          text,
          card_type: "memo",
          image_url: imageUrl,
          image_source: imageSource,
          client_request_id: requestId,
        };

        // Try with metadata fields first
        const metadataPayload = {
          ...basePayload,
          source_url: bmUrl.slice(0, 2000),
          title: title || null,
          site_name: siteName || null,
          preview_image_url: previewImg || null,
        };

        let { data, error } = await supabase
          .from("cards")
          .insert(metadataPayload)
          .select()
          .single();

        if (error?.code === "23505") {
          const { data: existing } = await supabase
            .from("cards")
            .select("*")
            .eq("client_request_id", requestId)
            .single();
          if (existing) {
            setCards((prev) => dedupeCards([existing, ...prev]));
            setLastSavedCard({
              id: existing.id,
              file_id: existing.file_id,
              media_kind: existing.media_kind,
              created_at: existing.created_at,
              pinned: existing.pinned,
            });
            saved = true;
          }
        } else if (error && (error.message?.includes("column") || error.code === "42703" || error.code === "PGRST204")) {
          // Check if preview_image_url is the missing column
          const errMsg = error.message || "";
          if (errMsg.includes("preview_image_url")) {
            setErrorBanner("Run migration: ALTER TABLE cards ADD COLUMN preview_image_url TEXT; (see OPS.md)");
            setTimeout(() => setErrorBanner(null), 8000);
            saved = false;
          }
          // Metadata columns missing — retry with base payload only
          const { data: baseData, error: baseError } = await supabase
            .from("cards")
            .insert(basePayload)
            .select()
            .single();

          if (baseError?.code === "23505") {
            const { data: existing } = await supabase
              .from("cards")
              .select("*")
              .eq("client_request_id", requestId)
              .single();
            if (existing) {
              setCards((prev) => dedupeCards([existing, ...prev]));
              setLastSavedCard({
                id: existing.id,
                file_id: existing.file_id,
                media_kind: existing.media_kind,
                created_at: existing.created_at,
                pinned: existing.pinned,
              });
              saved = true;
            }
          } else if (baseError) {
            const errCode = baseError.code || "";
            const errMsg = baseError.message || "";
            let msg = `Auto-save failed: ${errMsg}`;
            if (errCode === "PGRST204" || errCode === "42703" || errMsg.includes("file_id")) {
              msg += " — Run migration SQL to add file_id column (see OPS.md)";
            }
            setErrorBanner(msg);
            setTimeout(() => setErrorBanner(null), 8000);
          } else if (baseData) {
            setCards((prev) => dedupeCards([baseData, ...prev]));
            setLastSavedCard({
              id: baseData.id,
              file_id: baseData.file_id,
              media_kind: baseData.media_kind,
              created_at: baseData.created_at,
              pinned: baseData.pinned,
            });
            saved = true;
            // Show migration hint banner
            setErrorBanner("Metadata columns missing. Run migration SQL to enable rich cards (see OPS.md).");
            setTimeout(() => setErrorBanner(null), 8000);
          }
        } else if (error) {
          const errCode = error.code || "";
          const errMsg = error.message || "";
          let msg = `Auto-save failed: ${errMsg}`;
          if (errCode === "PGRST204" || errCode === "42703" || errMsg.includes("file_id")) {
            msg += " — Run migration SQL to add file_id column (see OPS.md)";
          } else if (errMsg.includes("title") || errMsg.includes("source_url") || errMsg.includes("site_name")) {
            msg += " — Run migration SQL to add metadata columns (see OPS.md)";
          }
          setErrorBanner(msg);
          setTimeout(() => setErrorBanner(null), 8000);
        } else if (data) {
          setCards((prev) => dedupeCards([data, ...prev]));
          setLastSavedCard({
            id: data.id,
            file_id: data.file_id,
            media_kind: data.media_kind,
            created_at: data.created_at,
            pinned: data.pinned,
          });
          saved = true;
        }
      } finally {
        savingRef.current = false;
        setSaving(false);
      }

      // Mark bookmarklet params as consumed and clean URL
      bmConsumedRef.current = true;
      autoSaveInProgressRef.current = false;
      window.history.replaceState({}, "", "/app");

      if (saved) {
        setBanner("Saved from bookmarklet");
        setTimeout(() => setBanner(null), 2500);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, configured, hasBmParams]);

  // Initialize search/filter/sort from URL query params (once)
  useEffect(() => {
    if (filterInitializedRef.current) return;
    filterInitializedRef.current = true;
    const q = searchParams.get("q") || "";
    const d = searchParams.get("d") || "all";
    const f = searchParams.get("f") || "all";
    const s = searchParams.get("sort") || "newest";
    const p = searchParams.get("p") === "1";
    setSearchQuery(q);
    setDomainFilter(d);
    setFileFilter(f);
    setSortOrder(s === "oldest" ? "oldest" : s === "custom" ? "custom" : "newest");
    setShowPinnedOnly(p);
  }, [searchParams]);

  // Sync search/filter/sort state to URL query params
  useEffect(() => {
    if (!filterInitializedRef.current) return; // Skip initial render
    if (autoSaveInProgressRef.current) return; // Skip while auto-save is running
    if (hasBmParams) return; // Skip while bookmarklet params not yet consumed

    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (domainFilter !== "all") params.set("d", domainFilter);
    if (fileFilter !== "all") params.set("f", fileFilter);
    if (mediaFilter !== "all") params.set("m", mediaFilter);
    if (sortOrder !== "newest") params.set("sort", sortOrder);
    if (showPinnedOnly) params.set("p", "1");
    if (e2eMode) params.set("e2e", "1");
    const query = params.toString();
    const newUrl = query ? `/app?${query}` : "/app";
    router.replace(newUrl, { scroll: false });
  }, [searchQuery, domainFilter, fileFilter, mediaFilter, sortOrder, showPinnedOnly, router, e2eMode]);

  // Extract unique domains from cards
  const domains = useMemo(() => {
    const domainSet = new Set<string>();
    cards.forEach((card) => {
      const url = extractFirstHttpUrl(card.text);
      if (!url) return;
      try {
        const hostname = new URL(url).hostname;
        domainSet.add(hostname);
      } catch {
        // Invalid URL, skip
      }
    });
    return Array.from(domainSet).sort();
  }, [cards]);

  // Check if a card would be hidden by current filters
  const wouldBeHiddenByFilters = useCallback((card: Card) => {
    // Pinned-only filter
    if (showPinnedOnly && !card.pinned) return true;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const text = card.text.toLowerCase();
      const url = extractFirstHttpUrl(card.text) || "";
      const title = (card.title || "").toLowerCase();
      const siteName = (card.site_name || "").toLowerCase();
      const aiSummary = (card.ai_summary || "").toLowerCase();
      const aiTags = (card.ai_tags || []).join(" ").toLowerCase();
      const matches =
        text.includes(q) ||
        url.toLowerCase().includes(q) ||
        title.includes(q) ||
        siteName.includes(q) ||
        aiSummary.includes(q) ||
        aiTags.includes(q);
      if (!matches) return true;
    }

    // Domain filter
    if (domainFilter !== "all") {
      const url = extractFirstHttpUrl(card.text);
      if (!url) return true;
      try {
        const hostname = new URL(url).hostname;
        if (hostname !== domainFilter) return true;
      } catch {
        return true;
      }
    }

    // File filter
    if (fileFilter === "unfiled" && card.file_id !== null) return true;
    if (fileFilter !== "all" && fileFilter !== "unfiled" && card.file_id !== fileFilter) return true;

    // Media filter
    if (mediaFilter === "link" && card.media_kind && card.media_kind !== "link") return true;
    if (mediaFilter === "image" && card.media_kind !== "image") return true;
    if (mediaFilter === "video" && card.media_kind !== "video") return true;

    return false;
  }, [showPinnedOnly, searchQuery, domainFilter, fileFilter, mediaFilter]);

  // Reveal a saved card by clearing filters that hide it
  const revealSavedCard = useCallback((card: { id: string; file_id?: string | null; pinned?: boolean }) => {
    setSearchQuery("");
    setDomainFilter("all");
    setShowPinnedOnly(false);
    setMediaFilter("all");

    // Set file filter to show the card
    if (card.file_id) {
      setFileFilter(card.file_id);
    } else {
      setFileFilter("all");
    }

    // Dismiss banner after revealing
    setTimeout(() => setLastSavedCard(null), 2000);

    // Scroll to card
    setTimeout(() => {
      const cardEl = document.getElementById(`card-${card.id}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }, []);

  // Navigate to card's file
  const goToCardFile = useCallback((fileId: string) => {
    setFileFilter(fileId);
    setSearchQuery("");
    setDomainFilter("all");
    setShowPinnedOnly(false);
    setMediaFilter("all");
    setTimeout(() => setLastSavedCard(null), 2000);
  }, []);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let result = [...cards];

    // Pinned-only filter
    if (showPinnedOnly) {
      result = result.filter((card) => card.pinned === true);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((card) => {
        const text = card.text.toLowerCase();
        const url = extractFirstHttpUrl(card.text) || "";
        const title = (card.title || "").toLowerCase();
        const siteName = (card.site_name || "").toLowerCase();
        const aiSummary = (card.ai_summary || "").toLowerCase();
        const aiTags = (card.ai_tags || []).join(" ").toLowerCase();
        return (
          text.includes(q) ||
          url.toLowerCase().includes(q) ||
          title.includes(q) ||
          siteName.includes(q) ||
          aiSummary.includes(q) ||
          aiTags.includes(q)
        );
      });
    }

    // Domain filter
    if (domainFilter !== "all") {
      result = result.filter((card) => {
        const url = extractFirstHttpUrl(card.text);
        if (!url) return false;
        try {
          const hostname = new URL(url).hostname;
          return hostname === domainFilter;
        } catch {
          return false;
        }
      });
    }

    // File filter
    if (fileFilter !== "all") {
      if (fileFilter === "unfiled") {
        result = result.filter((card) => !card.file_id);
      } else {
        result = result.filter((card) => card.file_id === fileFilter);
      }
    }

    // Media filter
    if (mediaFilter !== "all") {
      result = result.filter((card) => {
        if (mediaFilter === "link") {
          // Links: null or 'link' media_kind
          return !card.media_kind || card.media_kind === "link";
        } else if (mediaFilter === "image") {
          return card.media_kind === "image";
        } else if (mediaFilter === "video") {
          return card.media_kind === "video";
        }
        return true;
      });
    }

    // Sort: pinned cards first, then by sort mode
    result.sort((a, b) => {
      // Pinned cards always come first
      const aPinned = a.pinned ?? false;
      const bPinned = b.pinned ?? false;
      if (aPinned !== bPinned) return bPinned ? 1 : -1;

      // Within same pin status, sort by mode
      if (sortOrder === "custom") {
        // Custom sort: use sort_key if exists, fallback to created_at
        const aKey = a.sort_key || "";
        const bKey = b.sort_key || "";
        if (aKey && bKey) return aKey.localeCompare(bKey);
        if (aKey) return -1;
        if (bKey) return 1;
        // Both null: fallback to newest
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      }

      // Date sort
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    return result;
  }, [cards, searchQuery, domainFilter, fileFilter, mediaFilter, sortOrder, showPinnedOnly]);

  const handleLogout = async () => {
    if (!configured) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Extract URL from text and fetch OGP
  const fetchOgpImage = async (text: string): Promise<string | null> => {
    const match = text.match(URL_REGEX);
    if (!match) return null;
    try {
      const res = await fetch("/api/og-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: match[0] }),
      });
      if (!res.ok) return null;
      const { image } = await res.json();
      return image || null;
    } catch {
      return null;
    }
  };

  // Upload image to Supabase Storage
  const uploadImage = async (file: File, userId: string): Promise<string | null> => {
    if (!configured) return null;
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKETS.CARD_IMAGES)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKETS.CARD_IMAGES).getPublicUrl(path);
    return data.publicUrl;
  };

  const addCard = async () => {
    const text = input.trim();
    if (!text || !configured || !user) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    try {
      let image_url: string | null = null;
      let image_source: Card["image_source"] = null;

      // Priority: uploaded file > OGP from URL > generated fallback
      if (pendingFile) {
        image_url = await uploadImage(pendingFile, user.id);
        image_source = image_url ? "upload" : "generated";
        setPendingFile(null);
      } else {
        image_url = await fetchOgpImage(text);
        image_source = image_url ? "ogp" : "generated";
      }

      const supabase = createClient();
      const requestId = crypto.randomUUID();

      let { data, error } = await supabase
        .from("cards")
        .insert({
          user_id: user.id,
          text,
          card_type: selectedType,
          image_url,
          image_source,
          client_request_id: requestId,
        })
        .select()
        .single();

      if (error?.code === "23505") {
        // Unique constraint conflict — fetch the already-inserted row
        const { data: existing } = await supabase
          .from("cards")
          .select("*")
          .eq("client_request_id", requestId)
          .single();
        if (existing) {
          setCards((prev) => dedupeCards([existing, ...prev]));
          setLastSavedCard({
            id: existing.id,
            file_id: existing.file_id,
            media_kind: existing.media_kind,
            created_at: existing.created_at,
            pinned: existing.pinned,
          });
          setInput(""); // Clear on success
        }
        return;
      }

      if (error) {
        // Schema error — show banner with migration hint
        let msg = `Save failed: ${error.message}`;
        if (
          error.message?.includes("client_request_id") ||
          (error.message?.includes("column") && error.message?.includes("does not exist"))
        ) {
          msg += " — Run in Supabase SQL Editor: ALTER TABLE cards ADD COLUMN client_request_id TEXT; CREATE UNIQUE INDEX cards_client_request_id_key ON cards(client_request_id);";
        }
        setErrorBanner(msg);
        setTimeout(() => setErrorBanner(null), 8000);
        return;
      }

      if (data) {
        setCards((prev) => dedupeCards([data, ...prev]));
        setLastSavedCard({
          id: data.id,
          file_id: data.file_id,
          media_kind: data.media_kind,
          created_at: data.created_at,
          pinned: data.pinned,
        });
        setInput(""); // Clear only on success
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  const deleteCard = useCallback(async (id: string) => {
    if (!configured) return;
    const supabase = createClient();
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (!error) {
      setCards((prev) => prev.filter((c) => c.id !== id));
    }
  }, [configured]);

  const handlePinToggle = useCallback((id: string, newPinned: boolean) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: newPinned } : c))
    );
  }, []);

  const createFile = async () => {
    const name = newFileName.trim();
    if (!name || !configured || !user) return;
    setShowNewFileInput(false);
    setNewFileName("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("files")
        .insert({ user_id: user.id, name: name.slice(0, 60) })
        .select()
        .single();

      if (error) {
        const errCode = error.code || "";
        const errMsg = error.message || "";
        if (errCode === "PGRST204" || errCode === "42703" || errCode === "42P01" || errMsg.includes("relation") || errMsg.includes("does not exist")) {
          setErrorBanner("Run migration SQL to enable Files (see OPS.md)");
        } else {
          setErrorBanner(`Create file failed: ${errMsg.slice(0, 50)}`);
        }
        setTimeout(() => setErrorBanner(null), 5000);
        return;
      }

      if (data) {
        setFiles((prev) => [data, ...prev]);
        setBanner(`Created file: ${name}`);
        setTimeout(() => setBanner(null), 2500);
      }
    } catch (e) {
      setErrorBanner("Network error");
      setTimeout(() => setErrorBanner(null), 5000);
    }
  };

  const assignCardToFile = useCallback(async (cardId: string, fileId: string | null) => {
    if (!configured) return;
    const oldCard = cards.find((c) => c.id === cardId);
    if (!oldCard) return;
    const oldFileId = oldCard.file_id;

    // Optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, file_id: fileId } : c))
    );

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("cards")
        .update({ file_id: fileId })
        .eq("id", cardId);

      if (error) {
        // Revert
        setCards((prev) =>
          prev.map((c) => (c.id === cardId ? { ...c, file_id: oldFileId } : c))
        );
        const errCode = error.code || "";
        const errMsg = error.message || "";
        if (errCode === "PGRST204" || errCode === "42703" || errMsg.includes("column") || errMsg.includes("file_id")) {
          setErrorBanner("Run migration SQL to enable Files (see OPS.md)");
        } else {
          setErrorBanner(`Assign failed: ${errMsg.slice(0, 50)}`);
        }
        setTimeout(() => setErrorBanner(null), 5000);
      }
    } catch (e) {
      // Revert
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, file_id: oldFileId } : c))
      );
      setErrorBanner("Network error");
      setTimeout(() => setErrorBanner(null), 5000);
    }
  }, [cards, configured]);

  const bulkMoveToFile = useCallback(async (targetFileId: string | null) => {
    if (!configured || selectedCardIds.size === 0) return;

    const idsToMove = Array.from(selectedCardIds);
    const oldFileIds = new Map<string, string | null>();
    idsToMove.forEach(id => {
      const card = cards.find(c => c.id === id);
      if (card) oldFileIds.set(id, card.file_id || null);
    });

    // Optimistic update
    setCards((prev) =>
      prev.map((c) =>
        selectedCardIds.has(c.id)
          ? { ...c, file_id: targetFileId, sort_key: null }
          : c
      )
    );

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("cards")
        .update({ file_id: targetFileId, sort_key: null })
        .in("id", idsToMove);

      if (error) {
        // Revert
        setCards((prev) =>
          prev.map((c) => {
            const oldFileId = oldFileIds.get(c.id);
            return oldFileId !== undefined
              ? { ...c, file_id: oldFileId }
              : c;
          })
        );
        const errCode = error.code || "";
        const errMsg = error.message || "";
        if (errCode === "PGRST204" || errCode === "42703" || errMsg.includes("column") || errMsg.includes("file_id")) {
          setErrorBanner("Run migration SQL to enable Files (see OPS.md)");
        } else {
          setErrorBanner(`Bulk move failed: ${errMsg.slice(0, 50)}`);
        }
        setTimeout(() => setErrorBanner(null), 5000);
      } else {
        // Success
        const targetName = targetFileId
          ? files.find(f => f.id === targetFileId)?.name || "file"
          : "Unfiled";
        setBanner(`Moved ${idsToMove.length} cards to ${targetName}`);
        setTimeout(() => setBanner(null), 2500);
        setSelectedCardIds(new Set());
        setIsBulkMode(false);
      }
    } catch (e) {
      // Revert
      setCards((prev) =>
        prev.map((c) => {
          const oldFileId = oldFileIds.get(c.id);
          return oldFileId !== undefined
            ? { ...c, file_id: oldFileId }
            : c;
        })
      );
      setErrorBanner("Network error");
      setTimeout(() => setErrorBanner(null), 5000);
    }
  }, [cards, configured, selectedCardIds, files]);

  const toggleCardSelection = useCallback((cardId: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }, []);

  const toggleBulkMode = useCallback(() => {
    setIsBulkMode(prev => !prev);
    setSelectedCardIds(new Set());
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 8px movement before DnD activates, so click events on
      // MEMO / FILE chips still fire normally even in draggable mode.
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleCardUpdate = useCallback(async (cardId: string) => {
    if (!configured) return;
    const supabase = createClient();

    // Reload the card to get updated AI fields
    const { data } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (data) {
      setCards((prev) => prev.map((c) => (c.id === cardId ? data : c)));

      // Capture AI-updated card for reveal banner (if filters would hide it)
      setLastAiUpdatedCard({
        id: data.id,
        file_id: data.file_id,
        created_at: data.created_at,
      });

      // Auto-dismiss after 4 seconds
      setTimeout(() => setLastAiUpdatedCard(null), 4000);
    }
  }, [configured]);

  // Persist manual card order to localStorage (key per userId, covers all files)
  const persistManualOrder = useCallback((orderedIds: string[]) => {
    if (!user) return;
    try {
      const key = getManualOrderKey(user.id);
      localStorage.setItem(key, JSON.stringify(orderedIds));
    } catch {
      // Ignore quota / private mode errors
    }
  }, [user]);

  const readManualOrder = useCallback((): string[] => {
    if (!user) return [];
    try {
      const primary = localStorage.getItem(getManualOrderKey(user.id));
      const legacy = localStorage.getItem(`stillframe.manualOrder.v1:${user.id}`);
      const raw = primary ?? legacy;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [user]);

  // Restore manual order from localStorage when sort_keys are absent (custom sort mode)
  useEffect(() => {
    if (!user || sortOrder !== "custom" || loading) return;
    // Only apply if ALL visible cards lack sort_key (first-time custom sort session)
    const allMissingSortKey = cards.length > 0 && cards.every((c) => !c.sort_key);
    if (!allMissingSortKey) return;
    try {
      const savedIds = readManualOrder();
      if (!Array.isArray(savedIds) || savedIds.length === 0) return;
      // Apply saved order: assign synthetic sort_keys based on position
      setCards((prev) => {
        const posMap = new Map(savedIds.map((id, i) => [id, i]));
        return [...prev].sort((a, b) => {
          const ai = posMap.get(a.id) ?? Infinity;
          const bi = posMap.get(b.id) ?? Infinity;
          return ai - bi;
        });
      });
    } catch {
      // Ignore parse / storage errors
    }
  }, [user, sortOrder, loading, readManualOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !configured) return;

      const oldIndex = filteredCards.findIndex((c) => c.id === active.id);
      const newIndex = filteredCards.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const beforeCards = cardsRef.current;
      const beforeManualOrder = readManualOrder();

      // Optimistic update
      const reordered = arrayMove(filteredCards, oldIndex, newIndex);
      setCards((prev) => {
        const updated = [...prev];
        // Update filtered cards order in the main array
        const filterIds = new Set(filteredCards.map((c) => c.id));
        const filtered = updated.filter((c) => filterIds.has(c.id));
        const nonFiltered = updated.filter((c) => !filterIds.has(c.id));
        const reorderedIds = reordered.map((c) => c.id);
        const sortedFiltered = reorderedIds.map((id) => filtered.find((c) => c.id === id)!);
        return [...sortedFiltered, ...nonFiltered];
      });

      // Persist order to localStorage immediately (resilient to DB errors)
      persistManualOrder(reordered.map((c) => c.id));

      // Compute new sort_key
      const movedCard = filteredCards[oldIndex];
      const beforeCard = newIndex > 0 ? reordered[newIndex - 1] : null;
      const afterCard = newIndex < reordered.length - 1 ? reordered[newIndex + 1] : null;
      const newSortKey = generateKeyBetween(
        beforeCard?.sort_key || null,
        afterCard?.sort_key || null
      );

      // Update in DB
      const supabase = createClient();
      const { error } = await supabase
        .from("cards")
        .update({ sort_key: newSortKey })
        .eq("id", movedCard.id);

      if (error) {
        console.error("Drag reorder failed:", error);
        // Revert optimistic state + local manual order snapshot.
        setCards(() => beforeCards);
        persistManualOrder(beforeManualOrder);
        setErrorBanner("Reorder save failed. Restored previous order.");
        setTimeout(() => setErrorBanner(null), 3000);
      } else {
        // Update local state with new sort_key
        setCards((prev) =>
          prev.map((c) => (c.id === movedCard.id ? { ...c, sort_key: newSortKey } : c))
        );
      }
    },
    [filteredCards, configured, persistManualOrder, readManualOrder]
  );

  // Handle file drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setPendingFile(file);
    }
  };

  // Handle Add Hub file upload
  const handleUploadSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !configured || !user) return;

    // Validate file type (Phase0: limit to browser-compatible formats)
    const isImage = file.type.startsWith("image/");
    const isVideoMp4 = file.type === "video/mp4";
    const isVideoWebm = file.type === "video/webm";
    const isSupportedVideo = isVideoMp4 || isVideoWebm;

    if (!isImage && !isSupportedVideo) {
      const msg = file.type.startsWith("video/")
        ? "Only MP4 and WebM videos are supported. Please convert QuickTime (.mov) files to MP4."
        : "Only image and video files are supported";
      setErrorBanner(msg);
      setTimeout(() => setErrorBanner(null), 4000);
      return;
    }

    // Validate file size (100MB)
    if (file.size > 100 * 1024 * 1024) {
      setErrorBanner("File size must be under 100MB");
      setTimeout(() => setErrorBanner(null), 3000);
      return;
    }

    setShowAddHub(false);
    setSaving(true);

    try {
      const supabase = createClient();

      // 1. Create card first (minimal insert)
      const newCard: Partial<Card> = {
        user_id: user.id,
        text: `Uploaded: ${file.name}`,
        title: file.name,
        card_type: selectedType,
        media_kind: file.type.startsWith("image/") ? "image" : "video",
      };

      const { data: inserted, error: insertError } = await supabase
        .from("cards")
        .insert(newCard)
        .select()
        .single();

      if (insertError || !inserted) {
        throw new Error(insertError?.message || "Failed to create card");
      }

      // Add to UI optimistically
      setCards((prev) => [inserted, ...prev]);

      // 2. Generate thumbnail client-side
      const thumbnail = await generateThumbnail(file);

      // 3. Upload original + thumb to storage
      const fileExt = file.name.split(".").pop() || "bin";
      const originalPath = `${user.id}/${inserted.id}/original.${fileExt}`;
      const thumbPath = `${user.id}/${inserted.id}/thumb.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.CARDS_MEDIA)
        .upload(originalPath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw new Error("Failed to upload file");

      const { error: thumbError } = await supabase.storage
        .from(STORAGE_BUCKETS.CARDS_MEDIA)
        .upload(thumbPath, thumbnail, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (thumbError) throw new Error("Failed to upload thumbnail");

      // 4. Determine active file filter (read from URL to avoid state sync delay)
      const urlF = new URLSearchParams(window.location.search).get("f");
      const activeF = urlF ?? fileFilter;
      const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

      // 5. Build update payload with media fields + conditional file_id
      const updatePayload: any = {
        media_path: originalPath,
        media_thumb_path: thumbPath,
        media_mime: file.type,
        media_size: file.size,
      };

      let assignedFileId: string | null = null;
      if (activeF && isUuid(activeF)) {
        // Assign to the currently selected file (UUID)
        updatePayload.file_id = activeF;
        updatePayload.sort_key = null;
        assignedFileId = activeF;
      } else if (activeF === "unfiled") {
        // Explicitly set to unfiled
        updatePayload.file_id = null;
        assignedFileId = null;
      }
      // If activeF === "all" or invalid, do not modify file_id (leave as-is)

      // Single PATCH to update all fields at once
      const { error: updateError } = await supabase
        .from("cards")
        .update(updatePayload)
        .eq("id", inserted.id);

      if (updateError) throw new Error("Failed to update card metadata");

      // Update local state with final values
      setCards((prev) =>
        prev.map((c) =>
          c.id === inserted.id
            ? {
                ...c,
                media_path: originalPath,
                media_thumb_path: thumbPath,
                media_mime: file.type,
                media_size: file.size,
                file_id: assignedFileId !== undefined ? assignedFileId : c.file_id,
                sort_key: assignedFileId !== undefined ? null : c.sort_key,
              }
            : c
        )
      );

      // Capture saved card for reveal banner
      setLastSavedCard({
        id: inserted.id,
        file_id: assignedFileId !== undefined ? assignedFileId : inserted.file_id,
        media_kind: file.type.startsWith("image/") ? "image" : "video",
        created_at: inserted.created_at,
        pinned: inserted.pinned,
      });

      setBanner("Uploaded!");
      setTimeout(() => setBanner(null), 2000);
    } catch (err: any) {
      setErrorBanner(err.message || "Upload failed");
      setTimeout(() => setErrorBanner(null), 3000);
    } finally {
      setSaving(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Generate thumbnail from image or video
  const generateThumbnail = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      if (file.type.startsWith("image/")) {
        const img = new Image();
        img.onload = () => {
          const maxSize = 512;
          let { width, height } = img;
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to generate thumbnail"));
          }, "image/jpeg", 0.85);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = URL.createObjectURL(file);
      } else if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.onloadeddata = () => {
          video.currentTime = 0.2; // Seek to 0.2s
        };
        video.onseeked = () => {
          const maxSize = 512;
          let { videoWidth: width, videoHeight: height } = video;
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(video, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to generate video thumbnail"));
          }, "image/jpeg", 0.85);
        };
        video.onerror = () => reject(new Error("Failed to load video"));
        video.src = URL.createObjectURL(file);
      } else {
        reject(new Error("Unsupported file type"));
      }
    });
  };

  // Close Add Hub when clicking outside
  useEffect(() => {
    if (!showAddHub) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addHubRef.current && !addHubRef.current.contains(e.target as Node)) {
        setShowAddHub(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddHub]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.repeat && !e.nativeEvent.isComposing) {
      e.preventDefault();
      addCard();
    }
  };

  const ct = getCardType(selectedType);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-dm)",
          color: "#999",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!configured) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-dm)",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            textAlign: "center",
            padding: "32px 24px",
            borderRadius: 16,
            background: "#FFF8F0",
            border: "1px solid #F5C882",
          }}
        >
          <h2 style={{ fontSize: 18, color: "#2a2a2a", marginBottom: 12 }}>
            Supabase not configured
          </h2>
          <p style={{ fontSize: 14, color: "#777", lineHeight: 1.6 }}>
            Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
            your environment. See OPS/supabase-setup.md for instructions.
          </p>
          <p style={{ fontSize: 12, color: "#bbb", marginTop: 12, fontFamily: "monospace" }}>
            URL: {getConfigStatus().url ? "set" : "MISSING"} / KEY: {getConfigStatus().key ? "set" : "MISSING"}
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: 20,
              fontSize: 13,
              color: "#D9A441",
              textDecoration: "none",
            }}
          >
            Back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "var(--font-dm), system-ui, sans-serif",
      }}
    >
      {/* Always-mounted AI feedback bus - Phase0: hidden unless NEXT_PUBLIC_ENABLE_AI=1 */}
      {process.env.NEXT_PUBLIC_ENABLE_AI === "1" && <AiFeedbackBus />}

      {/* Auto-save banner */}
      {banner && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 20px",
            borderRadius: 8,
            background: "#2D8F50",
            color: "#fff",
            fontSize: 13,
            fontFamily: "var(--font-dm)",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {banner}
        </div>
      )}

      {/* Error banner */}
      {errorBanner && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 20px",
            borderRadius: 8,
            background: "#D93025",
            color: "#fff",
            fontSize: 12,
            fontFamily: "var(--font-dm)",
            zIndex: 101,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            maxWidth: "90vw",
            wordBreak: "break-word",
          }}
        >
          {errorBanner}
        </div>
      )}

      {/* Reveal saved card banner */}
      {lastSavedCard && wouldBeHiddenByFilters(cards.find((c) => c.id === lastSavedCard.id) || lastSavedCard as Card) && (
        <div
          style={{
            position: "fixed",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 16px",
            borderRadius: 8,
            background: "#FF8F00",
            color: "#fff",
            fontSize: 13,
            fontFamily: "var(--font-dm)",
            zIndex: 102,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>Saved, but hidden by filters.</span>
          <button
            onClick={() => revealSavedCard(lastSavedCard)}
            style={{
              padding: "6px 12px",
              borderRadius: 4,
              background: "#fff",
              color: "#FF8F00",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Show card
          </button>
          {lastSavedCard.file_id && (
            <button
              onClick={() => goToCardFile(lastSavedCard.file_id!)}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.3)",
                cursor: "pointer",
              }}
            >
              Go to its file
            </button>
          )}
          <button
            onClick={() => setLastSavedCard(null)}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              background: "transparent",
              color: "#fff",
              fontSize: 16,
              border: "none",
              cursor: "pointer",
              marginLeft: 4,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Reveal AI-updated card banner */}
      {lastAiUpdatedCard && wouldBeHiddenByFilters(cards.find((c) => c.id === lastAiUpdatedCard.id) || lastAiUpdatedCard as Card) && (
        <div
          style={{
            position: "fixed",
            top: 120,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 16px",
            borderRadius: 8,
            background: "#1976D2",
            color: "#fff",
            fontSize: 13,
            fontFamily: "var(--font-dm)",
            zIndex: 102,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>AI updated, but card hidden by filters.</span>
          <button
            onClick={() => revealSavedCard(lastAiUpdatedCard)}
            style={{
              padding: "6px 12px",
              borderRadius: 4,
              background: "#fff",
              color: "#1976D2",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Show card
          </button>
          <button
            onClick={() => setLastAiUpdatedCard(null)}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              background: "transparent",
              color: "#fff",
              fontSize: 16,
              border: "none",
              cursor: "pointer",
              marginLeft: 4,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Bulk action toolbar */}
      {isBulkMode && selectedCardIds.size > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 20px",
            borderRadius: 12,
            background: "#fff",
            border: "1.5px solid #4F6ED9",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            zIndex: 102,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "var(--font-dm)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "#4F6ED9" }}>
            {selectedCardIds.size} selected
          </span>
          <select
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                bulkMoveToFile(val === "unfiled" ? null : val);
                e.target.value = "";
              }
            }}
            style={{
              padding: "6px 12px",
              border: "1px solid #e0e0e0",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "var(--font-dm)",
              outline: "none",
              background: "#fff",
              cursor: "pointer",
            }}
            defaultValue=""
          >
            <option value="" disabled>Move to…</option>
            <option value="unfiled">Unfiled</option>
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          maxWidth: 1100,
          margin: "0 auto",
          borderBottom: "1px solid #e8e5e0",
        }}
      >
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 600,
            color: "#2a2a2a",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          <img
            src="/enso.png"
            alt=""
            style={{
              width: 20,
              height: 20,
            }}
          />
          SHINEN
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              style={{ width: 30, height: 30, borderRadius: "50%" }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "#EEF2FF",
                border: "1px solid #A0B8F5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                color: "#4F6ED9",
                fontWeight: 600,
              }}
            >
              {(user?.email?.[0] || "?").toUpperCase()}
            </div>
          )}
          <a
            href="/bookmarklet"
            style={{
              fontSize: 12,
              color: "#bbb",
              textDecoration: "none",
              fontFamily: "var(--font-dm)",
            }}
          >
            Bookmarklet
          </a>
          <button
            onClick={handleLogout}
            style={{
              fontSize: 13,
              color: "#999",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-dm)",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Quick Capture Input */}
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "24px 24px 0",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Type Selector */}
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {cardTypes.map((t) => (
            <button
              key={t.label}
              onClick={() => setSelectedType(t.label)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: `1.5px solid ${
                  selectedType === t.label ? t.border : "transparent"
                }`,
                background: selectedType === t.label ? t.bg : "transparent",
                color: t.accent,
                opacity: selectedType === t.label ? 1 : 0.4,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "var(--font-dm)",
                cursor: "pointer",
                transition: "all 0.15s",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              flex: 1,
              position: "relative",
              borderRadius: 16,
              border: `1.5px solid ${dragOver ? ct.accent : "#e8e5e0"}`,
              background: dragOver ? `${ct.bg}` : "#fff",
              transition: "border-color 0.2s, background 0.2s",
              overflow: "hidden",
            }}
          >
            {pendingFile && (
              <div
                style={{
                  padding: "8px 14px",
                  background: ct.bg,
                  borderBottom: `1px solid ${ct.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: ct.accent,
                }}
              >
                <span>{pendingFile.name}</span>
                <button
                  onClick={() => setPendingFile(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: ct.accent,
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "0 4px",
                  }}
                >
                  x
                </button>
              </div>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a thought... (Enter to save, Shift+Enter for newline)"
              rows={1}
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "none",
                fontSize: 15,
                fontFamily: "var(--font-dm)",
                background: "transparent",
                outline: "none",
                resize: "none",
                lineHeight: 1.5,
              }}
            />
          </div>
          <div style={{ position: "relative" }} ref={addHubRef}>
            <button
              onClick={() => setShowAddHub((prev) => !prev)}
              disabled={saving}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                border: "none",
                background: saving ? "#ddd" : ct.accent,
                color: "#fff",
                fontSize: 22,
                fontWeight: 300,
                cursor: saving ? "default" : "pointer",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {saving ? "..." : "+"}
            </button>

            {/* Add Hub Menu */}
            {showAddHub && !saving && (
              <div
                style={{
                  position: "absolute",
                  bottom: 56,
                  right: 0,
                  background: "#fff",
                  border: "1.5px solid #e8e5e0",
                  borderRadius: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  overflow: "hidden",
                  minWidth: 140,
                  zIndex: 50,
                }}
              >
                <button
                  onClick={() => {
                    setShowAddHub(false);
                    inputRef.current?.focus();
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    fontSize: 14,
                    fontFamily: "var(--font-dm)",
                    color: "#2a2a2a",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9f9f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  Text
                </button>
                <button
                  onClick={() => {
                    setShowAddHub(false);
                    fileInputRef.current?.click();
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    borderTop: "1px solid #f0f0f0",
                    textAlign: "left",
                    fontSize: 14,
                    fontFamily: "var(--font-dm)",
                    color: "#2a2a2a",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9f9f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  Upload
                </button>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleUploadSelect}
              style={{ display: "none" }}
            />
          </div>
        </div>

        {dragOver && (
          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: ct.accent,
              marginTop: 8,
            }}
          >
            Drop image to attach
          </p>
        )}
      </div>

      {/* Search/Filter/Sort Controls */}
      {cards.length > 0 && (
        <div
          style={{
            maxWidth: 1100,
            margin: "24px auto 0",
            padding: "0 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              padding: "12px 16px",
              borderRadius: 12,
              background: "#f9f9f9",
              border: "1px solid #e8e5e0",
            }}
          >
            {/* Search input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              style={{
                flex: "1 1 200px",
                padding: "8px 12px",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "var(--font-dm)",
                outline: "none",
                background: "#fff",
              }}
            />

            {/* Domain filter */}
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "var(--font-dm)",
                outline: "none",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="all">All domains</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* File filter */}
            <select
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "var(--font-dm)",
                outline: "none",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="all">All files</option>
              <option value="unfiled">Unfiled</option>
              {files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            {/* Media filter */}
            <select
              value={mediaFilter}
              onChange={(e) => setMediaFilter(e.target.value as "all" | "link" | "image" | "video")}
              style={{
                padding: "8px 12px",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "var(--font-dm)",
                outline: "none",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="all">All media</option>
              <option value="link">Links</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
            </select>

            {/* New file button */}
            {!showNewFileInput ? (
              <button
                onClick={() => setShowNewFileInput(true)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e0e0e0",
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: "var(--font-dm)",
                  background: "#fff",
                  cursor: "pointer",
                }}
                title="Create new file"
              >
                + File
              </button>
            ) : (
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createFile();
                    if (e.key === "Escape") {
                      setShowNewFileInput(false);
                      setNewFileName("");
                    }
                  }}
                  placeholder="File name..."
                  maxLength={60}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #D9A441",
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "var(--font-dm)",
                    outline: "none",
                    width: 150,
                  }}
                  autoFocus
                />
                <button
                  onClick={createFile}
                  style={{
                    padding: "8px 12px",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "var(--font-dm)",
                    background: "#D9A441",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setShowNewFileInput(false);
                    setNewFileName("");
                  }}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e0e0e0",
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "var(--font-dm)",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Sort order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest" | "custom")}
              style={{
                padding: "8px 12px",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "var(--font-dm)",
                outline: "none",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="custom">Custom order (drag)</option>
            </select>

            {/* Pinned filter toggle */}
            <button
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
              style={{
                padding: "8px 12px",
                border: showPinnedOnly ? "1.5px solid #F5C882" : "1px solid #e0e0e0",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "var(--font-dm)",
                outline: "none",
                background: showPinnedOnly ? "#FFF8F0" : "#fff",
                cursor: "pointer",
                fontWeight: showPinnedOnly ? 600 : 400,
                color: showPinnedOnly ? "#D9A441" : "#555",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {showPinnedOnly ? "⭐" : "☆"} Pinned only
            </button>

            {/* Bulk select toggle */}
            <button
              onClick={toggleBulkMode}
              style={{
                padding: "8px 12px",
                border: isBulkMode ? "1.5px solid #4F6ED9" : "1px solid #e0e0e0",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "var(--font-dm)",
                outline: "none",
                background: isBulkMode ? "#EEF2FF" : "#fff",
                cursor: "pointer",
                fontWeight: isBulkMode ? 600 : 400,
                color: isBulkMode ? "#4F6ED9" : "#555",
              }}
            >
              {isBulkMode ? "Cancel" : "Select"}
            </button>

            {/* Results count */}
            {(searchQuery || domainFilter !== "all" || mediaFilter !== "all" || showPinnedOnly) && (
              <span
                style={{
                  fontSize: 12,
                  color: "#777",
                  fontFamily: "var(--font-dm)",
                  whiteSpace: "nowrap",
                }}
              >
                {filteredCards.length} of {cards.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Cards Grid */}
      <div
        data-testid="card-grid"
        style={{
          maxWidth: 1600,
          margin: "32px auto 0",
          padding: "0 24px 60px",
        }}
      >
        {cards.length === 0 && !loading && (
          <p
            style={{
              textAlign: "center",
              color: "#bbb",
              fontSize: 14,
              padding: "60px 0",
            }}
          >
            No thoughts yet. Start capturing.
          </p>
        )}
        {cards.length > 0 && filteredCards.length === 0 && (
          <p
            style={{
              textAlign: "center",
              color: "#bbb",
              fontSize: 14,
              padding: "60px 0",
            }}
          >
            No cards match your filters.
          </p>
        )}
        {sortOrder === "custom" && (fileFilter === "all") && (
          <p
            style={{
              textAlign: "center",
              color: "#999",
              fontSize: 13,
              padding: "20px 0",
              fontFamily: "var(--font-dm)",
            }}
          >
            Select a file to enable drag reordering
          </p>
        )}
        {sortOrder === "custom" && fileFilter !== "all" ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 10,
                }}
              >
                {filteredCards.map((card, i) => (
                  <div key={card.id} id={`card-${card.id}`} data-testid="card-item" data-card-id={card.id}>
                    <AppCard card={card} index={i} onDelete={deleteCard} onPinToggle={handlePinToggle} onFileAssign={assignCardToFile} onUpdate={handleCardUpdate} files={files} isDraggable={true} isBulkMode={isBulkMode} isSelected={selectedCardIds.has(card.id)} onToggleSelect={toggleCardSelection} />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : sortOrder !== "custom" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
              justifyItems: filteredCards.length < 5 ? "center" : "stretch",
            }}
          >
            {filteredCards.map((card, i) => (
              <div key={card.id} id={`card-${card.id}`} data-testid="card-item" data-card-id={card.id}>
                <AppCard card={card} index={i} onDelete={deleteCard} onPinToggle={handlePinToggle} onFileAssign={assignCardToFile} onUpdate={handleCardUpdate} files={files} isDraggable={false} isBulkMode={isBulkMode} isSelected={selectedCardIds.has(card.id)} onToggleSelect={toggleCardSelection} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Build stamp (subtle, always visible for screenshot verification) */}
      <div
        style={{
          position: "fixed",
          bottom: 8,
          right: 8,
          fontSize: 9,
          color: "#999",
          opacity: 0.5,
          fontFamily: "monospace",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        build: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "unknown"}
      </div>
    </div>
  );
}

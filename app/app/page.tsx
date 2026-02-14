"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured, getConfigStatus } from "@/lib/supabase/client";
import { cardTypes, getCardType } from "@/lib/cardTypes";
import { extractFirstHttpUrl } from "@/lib/urlUtils";
import type { Card } from "@/lib/supabase/types";
import AppCard from "./AppCard";

const URL_REGEX = /https?:\/\/[^\s]+/;

function dedupeCards(cards: Card[]): Card[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

export default function AppPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cards, setCards] = useState<Card[]>([]);
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
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);
  const prefillAppliedRef = useRef(false);
  const autoSaveRanRef = useRef(false);
  const filterInitializedRef = useRef(false);
  const configured = isSupabaseConfigured();

  // Load user and cards
  useEffect(() => {
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
      setLoading(false);
    }
    init();
  }, [configured]);

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
    const params = new URLSearchParams(window.location.search);
    const bmUrl = params.get("url");
    if (!bmUrl || params.get("auto") !== "1") return;
    autoSaveRanRef.current = true;

    (async () => {
      const title = (params.get("title") || "").slice(0, 200).trim();
      const selection = (params.get("s") || "").slice(0, 1200).trim();
      const previewImg = (params.get("img") || "").slice(0, 2000).trim();
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
            saved = true;
          }
        } else if (error && (error.message?.includes("column") || error.code === "42703" || error.code === "PGRST204")) {
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
              saved = true;
            }
          } else if (baseError) {
            let msg = `Save failed: ${baseError.message}`;
            setErrorBanner(msg);
            setTimeout(() => setErrorBanner(null), 8000);
          } else if (baseData) {
            setCards((prev) => dedupeCards([baseData, ...prev]));
            saved = true;
            // Show migration hint banner
            setErrorBanner("Metadata columns missing. Run migration SQL to enable rich cards (see OPS.md).");
            setTimeout(() => setErrorBanner(null), 8000);
          }
        } else if (error) {
          let msg = `Save failed: ${error.message}`;
          setErrorBanner(msg);
          setTimeout(() => setErrorBanner(null), 8000);
        } else if (data) {
          setCards((prev) => dedupeCards([data, ...prev]));
          saved = true;
        }
      } finally {
        savingRef.current = false;
        setSaving(false);
      }

      window.history.replaceState({}, "", "/app");
      if (saved) {
        setBanner("Saved from bookmarklet");
        setTimeout(() => setBanner(null), 2500);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, configured]);

  // Initialize search/filter/sort from URL query params (once)
  useEffect(() => {
    if (filterInitializedRef.current) return;
    filterInitializedRef.current = true;
    const q = searchParams.get("q") || "";
    const d = searchParams.get("d") || "all";
    const s = searchParams.get("sort") || "newest";
    const p = searchParams.get("p") === "1";
    setSearchQuery(q);
    setDomainFilter(d);
    setSortOrder(s === "oldest" ? "oldest" : "newest");
    setShowPinnedOnly(p);
  }, [searchParams]);

  // Sync search/filter/sort state to URL query params
  useEffect(() => {
    if (!filterInitializedRef.current) return; // Skip initial render
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (domainFilter !== "all") params.set("d", domainFilter);
    if (sortOrder !== "newest") params.set("sort", sortOrder);
    if (showPinnedOnly) params.set("p", "1");
    const query = params.toString();
    const newUrl = query ? `/app?${query}` : "/app";
    router.replace(newUrl, { scroll: false });
  }, [searchQuery, domainFilter, sortOrder, showPinnedOnly, router]);

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
        return text.includes(q) || url.toLowerCase().includes(q);
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

    // Sort: pinned cards first, then by date
    result.sort((a, b) => {
      // Pinned cards always come first
      const aPinned = a.pinned ?? false;
      const bPinned = b.pinned ?? false;
      if (aPinned !== bPinned) return bPinned ? 1 : -1;

      // Within same pin status, sort by date
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    return result;
  }, [cards, searchQuery, domainFilter, sortOrder, showPinnedOnly]);

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
      .from("card-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data } = supabase.storage.from("card-images").getPublicUrl(path);
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

  // Handle file drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setPendingFile(file);
    }
  };

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
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 600,
            color: "#2a2a2a",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
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
          <button
            onClick={addCard}
            disabled={saving || !input.trim()}
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: "none",
              background: saving || !input.trim() ? "#ddd" : ct.accent,
              color: "#fff",
              fontSize: 22,
              fontWeight: 300,
              cursor: saving || !input.trim() ? "default" : "pointer",
              transition: "background 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {saving ? "..." : "+"}
          </button>
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

            {/* Sort order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
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

            {/* Results count */}
            {(searchQuery || domainFilter !== "all" || showPinnedOnly) && (
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
        style={{
          maxWidth: 1100,
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
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: filteredCards.length < 5 ? "center" : "flex-start",
          }}
        >
          {filteredCards.map((card, i) => (
            <AppCard key={card.id} card={card} index={i} onDelete={deleteCard} onPinToggle={handlePinToggle} />
          ))}
        </div>
      </div>
    </div>
  );
}

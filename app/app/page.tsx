"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient, isSupabaseConfigured, getConfigStatus } from "@/lib/supabase/client";
import { cardTypes, getCardType } from "@/lib/cardTypes";
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
  const [cards, setCards] = useState<Card[]>([]);
  const [input, setInput] = useState("");
  const [selectedType, setSelectedType] = useState("memo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string; avatar_url?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);
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
        window.location.href = "/auth/login";
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
    setInput(""); // Clear immediately — text captured in local var above

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
      const basePayload = {
        user_id: user.id,
        text,
        card_type: selectedType,
        image_url,
        image_source,
      };

      let { data, error } = await supabase
        .from("cards")
        .insert({ ...basePayload, client_request_id: requestId })
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
        }
        return;
      }

      // Fallback: column may not exist yet — retry without client_request_id
      if (error) {
        ({ data, error } = await supabase
          .from("cards")
          .insert(basePayload)
          .select()
          .single());
      }

      if (!error && data) {
        setCards((prev) => dedupeCards([data, ...prev]));
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
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: cards.length < 5 ? "center" : "flex-start",
          }}
        >
          {cards.map((card, i) => (
            <AppCard key={card.id} card={card} index={i} onDelete={deleteCard} />
          ))}
        </div>
      </div>
    </div>
  );
}

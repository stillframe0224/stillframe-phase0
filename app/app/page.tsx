"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import ShinenCanvas from "./shinen/ShinenCanvas";
import "./shinen/shinen.css";
import "./types"; // Import window type extension

function buildE2EMockCards() {
  const types = [0, 1, 2, 3, 6, 7]; // melody, idea, quote, task, fragment, dream
  const now = Date.now();
  // Fixed non-overlapping positions so Playwright pointer events are not intercepted.
  // Cards are spread across a 700×400 area at z=-80 (same depth = no 3D overlap).
  const positions = [
    { px: -300, py: -160 },
    { px:   80, py: -160 },
    { px:  360, py: -160 },
    { px: -300, py:  120 },
    { px:   80, py:  120 },
    { px:  360, py:  120 },
  ];
  return types.map((type, i) => ({
    id: now + i,
    type,
    text: `E2E mock card ${i + 1}`,
    px: positions[i].px,
    py: positions[i].py,
    z: -80,
  }));
}

export default function AppPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  const e2eMode =
    typeof window !== "undefined" &&
    window.__E2E_ALLOWED__ === true &&
    new URLSearchParams(window.location.search).get("e2e") === "1";

  useEffect(() => {
    if (e2eMode) {
      setAuthed(true);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured()) {
      setAuthed(true);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/auth/login");
      } else {
        setAuthed(true);
      }
      setLoading(false);
    });
  }, [router, e2eMode]);

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fdfdfd",
          fontFamily: "'DM Sans',sans-serif",
          gap: 16,
        }}
      >
        {/* Spinner */}
        <svg
          width={32}
          height={32}
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(0,0,0,0.15)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            animation: "spin 1s linear infinite",
          }}
        >
          <circle cx="12" cy="12" r="10" opacity="0.25" />
          <path d="M12 2 A10 10 0 0 1 22 12" stroke="rgba(79,110,217,0.5)" />
        </svg>
        <div
          style={{
            color: "rgba(0,0,0,0.2)",
            fontSize: 13,
            letterSpacing: "0.05em",
          }}
        >
          loading your thoughts…
        </div>
        <style jsx>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (!authed) return null;

  return (
    <div className="app-grid-bg">
      <ShinenCanvas initialCards={e2eMode ? buildE2EMockCards() : undefined} e2eMode={e2eMode} />
    </div>
  );
}

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
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid rgba(0,0,0,0.1)",
            borderTopColor: "rgba(0,0,0,0.4)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div
          style={{
            color: "rgba(0,0,0,0.3)",
            fontSize: 13,
          }}
        >
          loading...
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!authed) {
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
          color: "rgba(0,0,0,0.4)",
          fontSize: 14,
          gap: 12,
        }}
      >
        <div>Authentication required</div>
        <a
          href="/auth/login"
          style={{
            color: "rgba(0,0,0,0.6)",
            textDecoration: "underline",
            fontSize: 13,
          }}
        >
          Go to login
        </a>
      </div>
    );
  }

  return (
    <div className="app-grid-bg">
      <ShinenCanvas initialCards={e2eMode ? buildE2EMockCards() : undefined} e2eMode={e2eMode} />
    </div>
  );
}

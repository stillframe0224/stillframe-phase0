"use client";

import { useState } from "react";
import copy from "@/lib/copy";
import type { Lang } from "@/lib/copy";
import { track } from "@/lib/track";

interface WaitlistProps {
  lang: Lang;
  postUrl: string;
  fallbackEmail: string;
}

export default function Waitlist({
  lang,
  postUrl,
  fallbackEmail,
}: WaitlistProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const c = copy.waitlist;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    track("waitlist_submit", { email });
    setLoading(true);

    if (postUrl) {
      try {
        await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      } catch {
        // fallback silently
      }
    } else if (fallbackEmail) {
      window.location.href = `mailto:${fallbackEmail}?subject=SHINEN Waitlist&body=Please add ${email} to the waitlist.`;
    }

    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <span style={{ fontSize: 32, display: "block", marginBottom: 12 }}>
          &#10003;
        </span>
        <p
          style={{
            fontSize: 16,
            color: "#2a2a2a",
            fontFamily: "var(--font-dm)",
          }}
        >
          {c.success[lang]}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: 10,
        maxWidth: 440,
        margin: "0 auto",
      }}
    >
      <input
        type="email"
        required
        placeholder={c.placeholder[lang]}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          flex: 1,
          padding: "12px 18px",
          borderRadius: 999,
          border: "1px solid #ddd",
          fontSize: 15,
          fontFamily: "var(--font-dm)",
          outline: "none",
          background: "#fff",
        }}
      />
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "12px 24px",
          borderRadius: 999,
          border: "none",
          background: "#2a2a2a",
          color: "#fff",
          fontSize: 14,
          fontWeight: 500,
          fontFamily: "var(--font-dm)",
          cursor: loading ? "wait" : "pointer",
          transition: "background 0.2s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#444")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#2a2a2a")}
      >
        {c.cta[lang]}
      </button>
    </form>
  );
}

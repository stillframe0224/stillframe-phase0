"use client";

import { useState } from "react";
import copy from "@/lib/copy";
import type { Lang } from "@/lib/copy";
import { track } from "@/lib/track";
import { PrimaryButton } from "@/ui/components/ui";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const c = copy.waitlist;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    track("waitlist_submit", { email: normalizedEmail });
    setLoading(true);
    setErrorMessage(null);

    try {
      if (postUrl) {
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        });

        if (!res.ok) throw new Error(`waitlist_submit_failed_${res.status}`);
      } else if (fallbackEmail) {
        window.location.href = `mailto:${fallbackEmail}?subject=SHINEN Waitlist&body=Please add ${normalizedEmail} to the waitlist.`;
      } else {
        throw new Error("waitlist_destination_missing");
      }

      setSubmitted(true);
    } catch {
      setErrorMessage(c.error[lang]);
      track("waitlist_submit_failed", { email: normalizedEmail });
    } finally {
      setLoading(false);
    }
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
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <input
          type="email"
          required
          placeholder={c.placeholder[lang]}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          style={{
            flex: "1 1 240px",
            minWidth: 0,
            padding: "12px 18px",
            borderRadius: 999,
            border: "1px solid #ddd",
            fontSize: 15,
            fontFamily: "var(--font-dm)",
            outline: "none",
            background: "#fff",
          }}
        />
        <PrimaryButton
          data-testid="cta-waitlist"
          aria-label={loading ? c.submitting[lang] : c.cta[lang]}
          type="submit"
          disabled={loading}
          className="rounded-full px-6 py-3 text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D9A441]"
          style={{
            cursor: loading ? "wait" : undefined,
            flex: "1 0 auto",
          }}
        >
          {loading ? c.submitting[lang] : c.cta[lang]}
        </PrimaryButton>
      </form>
      {errorMessage && (
        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "#b42318",
            fontFamily: "var(--font-dm)",
            textAlign: "center",
          }}
        >
          {errorMessage}
        </p>
      )}
      <p
        style={{
          marginTop: 12,
          fontSize: 12,
          color: "#8a8a8a",
          fontFamily: "var(--font-dm)",
          textAlign: "center",
        }}
      >
        {c.trust[lang]}
      </p>
    </div>
  );
}

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

function isValidEmail(email: string): boolean {
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  
  // TLD must be at least 2 characters
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) return false;
  
  return true;
}

// Common typo patterns that should be flagged
function getEmailSuggestion(email: string): string | null {
  const typos: Record<string, string> = {
    "gmai.com": "gmail.com",
    "gmil.com": "gmail.com",
    "gnail.com": "gmail.com",
    "yahooo.com": "yahoo.com",
    "yaho.com": "yahoo.com",
    "hotmial.com": "hotmail.com",
    "outloo.com": "outlook.com",
  };
  
  const [local, domain] = email.split('@');
  if (!domain) return null;
  
  const suggestion = typos[domain.toLowerCase()];
  if (suggestion) {
    return `${local}@${suggestion}`;
  }
  
  return null;
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
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const c = copy.waitlist;

  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid = isValidEmail(normalizedEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedEmail || !isEmailValid) {
      setErrorMessage(
        lang === "ja"
          ? "有効なメールアドレスを入力してください"
          : "Please enter a valid email address"
      );
      return;
    }

    const destination = postUrl ? "webhook" : fallbackEmail ? "mailto" : "none";
    track("waitlist_submit", { email: normalizedEmail, destination });
    setLoading(true);
    setErrorMessage(null);

    try {
      if (postUrl) {
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        });

        track("waitlist_submit_result", {
          email: normalizedEmail,
          destination,
          status: String(res.status),
          ok: String(res.ok),
        });

        if (!res.ok) throw new Error(`waitlist_submit_failed_${res.status}`);
      } else if (fallbackEmail) {
        window.location.href = `mailto:${fallbackEmail}?subject=SHINEN Waitlist&body=Please add ${normalizedEmail} to the waitlist.`;
      } else {
        throw new Error("waitlist_destination_missing");
      }

      setSubmitted(true);
    } catch (error) {
      // Network errors (fetch failed) show connection-specific message
      const isNetworkError = error instanceof TypeError && 
        (error.message.includes("Failed to fetch") || error.message.includes("Network request failed"));
      setErrorMessage(isNetworkError ? c.errorNetwork[lang] : c.error[lang]);
      track("waitlist_submit_failed", {
        email: normalizedEmail,
        destination,
        reason: error instanceof Error ? error.message : "unknown_error",
        isNetworkError: String(isNetworkError),
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }} role="status" aria-live="polite">
        <span style={{ fontSize: 32, display: "block", marginBottom: 12 }} aria-hidden="true">
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
        <PrimaryButton
          data-testid="waitlist-pricing-cta"
          onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
          className="rounded-full px-6 py-2.5 text-sm mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-strong)]"
        >
          {lang === "ja" ? "料金を見る" : "View Pricing"}
        </PrimaryButton>
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
          data-testid="waitlist-email"
          type="email"
          required
          aria-label={c.placeholder[lang]}
          placeholder={c.placeholder[lang]}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errorMessage) setErrorMessage(null);
            if (suggestion) setSuggestion(null);
          }}
          onBlur={() => {
            const trimmed = email.trim().toLowerCase();
            if (trimmed && !isValidEmail(trimmed)) {
              setErrorMessage(
                lang === "ja"
                  ? "有効なメールアドレスを入力してください"
                  : "Please enter a valid email address"
              );
            }
            const emailSuggestion = getEmailSuggestion(trimmed);
            if (emailSuggestion) {
              setSuggestion(emailSuggestion);
            }
          }}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={errorMessage ? "true" : "false"}
          aria-describedby={errorMessage ? "waitlist-error" : undefined}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#2a2a2a]"
          style={{
            flex: "1 1 240px",
            minWidth: 0,
            padding: "12px 18px",
            borderRadius: 999,
            border: errorMessage ? "1px solid #b42318" : "1px solid #ddd",
            fontSize: 15,
            fontFamily: "var(--font-dm)",
            background: "#fff",
            transition: "border-color 0.2s ease",
          }}
        />
        <PrimaryButton
          data-testid="cta-waitlist"
          aria-label={loading ? c.submitting[lang] : c.cta[lang]}
          type="submit"
          disabled={loading}
          className="rounded-full px-6 py-3 text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-strong)]"
          style={{
            cursor: loading ? "wait" : undefined,
            flex: "1 0 auto",
          }}
        >
          {loading ? c.submitting[lang] : c.cta[lang]}
        </PrimaryButton>
      </form>
      {suggestion && !errorMessage && (
        <p
          role="status"
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "#f59e0b",
            fontFamily: "var(--font-dm)",
            textAlign: "center",
          }}
        >
          {lang === "ja" ? "もしかして: " : "Did you mean: "}
          <button
            type="button"
            onClick={() => {
              setEmail(suggestion);
              setSuggestion(null);
            }}
            style={{
              color: "#2563eb",
              textDecoration: "underline",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "var(--font-dm)",
            }}
          >
            {suggestion}
          </button>
        </p>
      )}
      {errorMessage && (
        <p
          id="waitlist-error"
          role="alert"
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "#b42318",
            fontFamily: "var(--font-dm)",
            textAlign: "center",
            animation: "fadeIn 0.2s ease-in",
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

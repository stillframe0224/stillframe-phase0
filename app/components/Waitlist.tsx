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

type EmailValidationError =
  | "empty"
  | "too_long"
  | "local_too_long"
  | "missing_at"
  | "missing_domain"
  | "missing_tld"
  | "invalid_chars"
  | "consecutive_dots"
  | "edge_dots";

function validateEmail(email: string): EmailValidationError | null {
  if (!email) return "empty";
  // RFC 5321 — overall address max 254 chars
  if (email.length > 254) return "too_long";

  const atCount = (email.match(/@/g) || []).length;
  if (atCount === 0) return "missing_at";
  if (atCount > 1) return "invalid_chars";

  const [local, domain] = email.split("@");
  if (!local) return "missing_at";
  if (!domain) return "missing_domain";

  // RFC 5321 — local part max 64 chars
  if (local.length > 64) return "local_too_long";

  // No leading/trailing dots, no consecutive dots
  if (local.startsWith(".") || local.endsWith(".")) return "edge_dots";
  if (domain.startsWith(".") || domain.endsWith(".")) return "edge_dots";
  if (local.includes("..") || domain.includes("..")) return "consecutive_dots";

  // Domain must contain a dot and a TLD of 2+ chars
  const domainParts = domain.split(".");
  if (domainParts.length < 2) return "missing_tld";
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) return "missing_tld";

  // Allowed characters (conservative subset of RFC 5322)
  const localRegex = /^[A-Za-z0-9._%+-]+$/;
  const domainRegex = /^[A-Za-z0-9.-]+$/;
  if (!localRegex.test(local) || !domainRegex.test(domain)) return "invalid_chars";

  return null;
}

function errorMessageFor(
  code: EmailValidationError,
  lang: Lang
): string {
  const ja: Record<EmailValidationError, string> = {
    empty: "メールアドレスを入力してください",
    too_long: "メールアドレスが長すぎます（254文字以内）",
    local_too_long: "@より前の部分が長すぎます（64文字以内）",
    missing_at: "「@」を含む有効なメールアドレスを入力してください",
    missing_domain: "「@」のあとにドメインを入力してください",
    missing_tld: "ドメインが不完全です（例: example.com）",
    invalid_chars: "使用できない文字が含まれています",
    consecutive_dots: "「..」のように連続したドットは使用できません",
    edge_dots: "先頭または末尾にドットは使用できません",
  };
  const en: Record<EmailValidationError, string> = {
    empty: "Please enter an email address",
    too_long: "Email is too long (max 254 characters)",
    local_too_long: "The part before @ is too long (max 64 characters)",
    missing_at: "Please enter a valid email address including @",
    missing_domain: "Please enter a domain after @",
    missing_tld: "Domain looks incomplete (e.g. example.com)",
    invalid_chars: "Contains characters that aren't allowed",
    consecutive_dots: "Consecutive dots like \"..\" aren't allowed",
    edge_dots: "Dots can't appear at the start or end",
  };
  return lang === "ja" ? ja[code] : en[code];
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

  const normalizedEmail = email.trim().toLowerCase();
  const validationError = validateEmail(normalizedEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) {
      setErrorMessage(errorMessageFor(validationError, lang));
      track("waitlist_submit_invalid", {
        reason: validationError,
        length: String(normalizedEmail.length),
      });
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
        aria-busy={loading}
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
          maxLength={254}
          aria-label={c.placeholder[lang]}
          placeholder={c.placeholder[lang]}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          onBlur={() => {
            if (email.length > 0 && validationError) {
              setErrorMessage(errorMessageFor(validationError, lang));
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

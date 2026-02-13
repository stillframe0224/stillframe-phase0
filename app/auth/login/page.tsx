"use client";

import { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  const handleGoogle = async () => {
    if (!configured) return;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  };

  const handleMagicLink = async () => {
    if (!configured || !email.trim()) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-dm), system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 400,
            color: "#2a2a2a",
            marginBottom: 8,
          }}
        >
          SHINEN
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "#999",
            marginBottom: 36,
          }}
        >
          Sign in to save your thoughts
        </p>

        {!configured && (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 12,
              background: "#FFF8F0",
              border: "1px solid #F5C882",
              marginBottom: 24,
              fontSize: 13,
              color: "#C07820",
              lineHeight: 1.6,
            }}
          >
            Supabase is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "#FDF2F8",
              border: "1px solid #F0A0D0",
              marginBottom: 16,
              fontSize: 13,
              color: "#C04890",
            }}
          >
            {error}
          </div>
        )}

        {sent ? (
          <div
            style={{
              padding: "20px",
              borderRadius: 14,
              background: "#F0FFF4",
              border: "1px solid #7EDBA0",
              fontSize: 14,
              color: "#2D8F50",
              lineHeight: 1.6,
            }}
          >
            Check your email for the login link.
          </div>
        ) : (
          <>
            {/* Google Sign In */}
            <button
              onClick={handleGoogle}
              disabled={!configured}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: 12,
                border: "1px solid #e8e5e0",
                background: "#fff",
                fontSize: 15,
                fontWeight: 500,
                color: "#2a2a2a",
                cursor: configured ? "pointer" : "not-allowed",
                opacity: configured ? 1 : 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                fontFamily: "var(--font-dm)",
                transition: "border-color 0.2s, box-shadow 0.2s",
                marginBottom: 16,
              }}
              onMouseEnter={(e) => {
                if (configured) {
                  e.currentTarget.style.borderColor = "#A0B8F5";
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(79,110,217,0.1)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e8e5e0";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                  fill="#4285F4"
                />
                <path
                  d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                  fill="#FBBC05"
                />
                <path
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "20px 0",
              }}
            >
              <div style={{ flex: 1, height: 1, background: "#e8e5e0" }} />
              <span style={{ fontSize: 12, color: "#bbb" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#e8e5e0" }} />
            </div>

            {/* Magic Link */}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
              placeholder="you@email.com"
              disabled={!configured}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: 12,
                border: "1px solid #e8e5e0",
                fontSize: 15,
                fontFamily: "var(--font-dm)",
                background: "#fff",
                outline: "none",
                marginBottom: 12,
                opacity: configured ? 1 : 0.5,
              }}
            />
            <button
              onClick={handleMagicLink}
              disabled={!configured || loading}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: 12,
                border: "none",
                background: "#2a2a2a",
                color: "#fff",
                fontSize: 15,
                fontWeight: 500,
                cursor:
                  configured && !loading ? "pointer" : "not-allowed",
                opacity: configured && !loading ? 1 : 0.5,
                fontFamily: "var(--font-dm)",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                if (configured && !loading)
                  e.currentTarget.style.background = "#444";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#2a2a2a";
              }}
            >
              {loading ? "Sending..." : "Sign in with email"}
            </button>
          </>
        )}

        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: 32,
            fontSize: 13,
            color: "#bbb",
            textDecoration: "none",
          }}
        >
          Back to home
        </a>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/ui/components/ui";
import AppHeader from "@/ui/components/AppHeader";

interface KPIData {
  ok: boolean;
  ts: string;
  total_cards: number;
  distinct_users: number;
  cards_7d: number | null;
  cards_1d: number | null;
  waitlist_total: number | null;
  payment_intent: number | null;
  preorders: number | null;
  thresholds: {
    waitlist: number;
    payment_intent: number;
    preorders: number;
  };
  notes?: string;
  error?: string;
}

interface KRProgress {
  label: string;
  current: number | null;
  target: number;
  unit: string;
  desc: string;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div style={{
      width: "100%",
      height: 8,
      background: "rgba(0,0,0,0.06)",
      borderRadius: 999,
      overflow: "hidden",
      marginTop: 12,
    }}>
      <div style={{
        width: `${percentage}%`,
        height: "100%",
        background: percentage >= 100 ? "#10b981" : "rgba(0,0,0,0.7)",
        transition: "width 0.3s ease",
      }} />
    </div>
  );
}

export default function KPIDashboard() {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/phase0-kpi")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-dm), system-ui, sans-serif",
      }}>
        <p style={{ color: "#999" }}>Loading KPI data...</p>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div style={{
        minHeight: "100vh",
        padding: "40px 24px",
        fontFamily: "var(--font-dm), system-ui, sans-serif",
      }}>
        <AppHeader lang="en" onToggle={() => {}} byline="Phase0 KPI Dashboard" />
        <div style={{
          maxWidth: 640,
          margin: "80px auto 0",
          textAlign: "center",
        }}>
          <p style={{ color: "#e55353", fontSize: 14 }}>
            {error || data?.error || "Failed to load KPI data"}
          </p>
        </div>
      </div>
    );
  }

  // Phase0 KR targets from GOALS.md
  const krs: KRProgress[] = [
    {
      label: "KR1: Waitlist",
      current: data.waitlist_total,
      target: 50,
      unit: "registrations",
      desc: "Waitlist registrations (tracked externally)",
    },
    {
      label: "KR2: Gumroad",
      current: data.preorders,
      target: 3,
      unit: "purchases",
      desc: "$29 tier purchases (tracked via Gumroad)",
    },
    {
      label: "KR3: DAU",
      current: data.distinct_users,
      target: 10,
      unit: "users",
      desc: "Daily Active Users (7-day streak target)",
    },
    {
      label: "KR4: Cards",
      current: data.total_cards,
      target: 100,
      unit: "cards",
      desc: "Total cards created across all users",
    },
  ];

  return (
    <div
      className="paper-grid-bg"
      style={{
        minHeight: "100vh",
        fontFamily: "var(--font-dm), system-ui, sans-serif",
      }}
    >
      <AppHeader lang="en" onToggle={() => {}} byline="Phase0 KPI Dashboard" />

      <main style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "80px 24px 60px",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: 36,
            fontWeight: 400,
            color: "#2a2a2a",
            marginBottom: 12,
          }}>
            Phase0 KPI Dashboard
          </h1>
          <p style={{
            fontSize: 14,
            color: "#999",
            fontFamily: "var(--font-dm)",
          }}>
            Last updated: {new Date(data.ts).toLocaleString()}
          </p>
        </div>

        {/* KR Progress Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          marginBottom: 48,
        }}>
          {krs.map((kr, i) => (
            <Card
              key={i}
              title={kr.label}
              body={
                <div>
                  <p style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
                    {kr.desc}
                  </p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 600, color: "#2a2a2a" }}>
                      {kr.current !== null ? kr.current : "–"}
                    </span>
                    <span style={{ fontSize: 14, color: "#999" }}>
                      / {kr.target} {kr.unit}
                    </span>
                  </div>
                  {kr.current !== null && (
                    <ProgressBar value={kr.current} max={kr.target} />
                  )}
                  {kr.current === null && (
                    <p style={{ fontSize: 12, color: "#bbb", marginTop: 8 }}>
                      (External data — not available)
                    </p>
                  )}
                </div>
              }
            />
          ))}
        </div>

        {/* Additional Metrics */}
        <section style={{
          background: "rgba(0,0,0,0.02)",
          borderRadius: 16,
          padding: "24px 28px",
          border: "1px solid rgba(0,0,0,0.06)",
        }}>
          <h2 style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            color: "#2a2a2a",
            marginBottom: 20,
          }}>
            Database Metrics
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}>
            <div>
              <p style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                Cards (Last 7 days)
              </p>
              <p style={{ fontSize: 22, fontWeight: 600, color: "#2a2a2a" }}>
                {data.cards_7d ?? "–"}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                Cards (Last 24 hours)
              </p>
              <p style={{ fontSize: 22, fontWeight: 600, color: "#2a2a2a" }}>
                {data.cards_1d ?? "–"}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                Distinct Users
              </p>
              <p style={{ fontSize: 22, fontWeight: 600, color: "#2a2a2a" }}>
                {data.distinct_users}
              </p>
            </div>
          </div>
        </section>

        {/* Notes */}
        {data.notes && (
          <div style={{
            marginTop: 32,
            padding: "16px 20px",
            background: "#fff9e6",
            border: "1px solid #ffe066",
            borderRadius: 12,
            fontSize: 13,
            color: "#666",
            lineHeight: 1.6,
          }}>
            <strong style={{ display: "block", marginBottom: 8, color: "#2a2a2a" }}>
              Notes:
            </strong>
            {data.notes}
          </div>
        )}
      </main>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CardStats {
  total: number;
  byType: Record<string, number>;
  byDay: Array<{ date: string; count: number }>;
}

async function getCardStats(): Promise<CardStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { total: 0, byType: {}, byDay: [] };

  // Total cards
  const { count: total } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Cards by type
  const { data: typeData } = await supabase
    .from("cards")
    .select("type")
    .eq("user_id", user.id);
  const byType: Record<string, number> = {};
  if (typeData) {
    for (const { type } of typeData) {
      byType[type] = (byType[type] || 0) + 1;
    }
  }

  // Cards by day (last 7 days)
  const { data: dayData } = await supabase
    .from("cards")
    .select("created_at")
    .eq("user_id", user.id)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });
  const byDay: Array<{ date: string; count: number }> = [];
  if (dayData) {
    const counts = new Map<string, number>();
    for (const { created_at } of dayData) {
      const date = new Date(created_at).toISOString().split("T")[0];
      counts.set(date, (counts.get(date) || 0) + 1);
    }
    for (const [date, count] of counts.entries()) {
      byDay.push({ date, count });
    }
    byDay.sort((a, b) => b.date.localeCompare(a.date));
  }

  return { total: total || 0, byType, byDay };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const stats = await getCardStats();

  return (
    <div style={{ maxWidth: "900px", margin: "40px auto", padding: "20px", fontFamily: "'DM Sans', sans-serif" }}>
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "32px" }}>SHINEN Dashboard</h1>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px" }}>📊 Overview</h2>
        <div style={{ fontSize: "48px", fontWeight: 700, color: "#5856d6" }}>{stats.total}</div>
        <div style={{ fontSize: "14px", color: "#666" }}>Total cards created</div>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px" }}>📅 Daily Activity (Last 7 days)</h2>
        {stats.byDay.length === 0 ? (
          <div style={{ color: "#999" }}>No cards created in the last 7 days.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                <th style={{ textAlign: "left", padding: "8px", fontWeight: 600 }}>Date</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>Cards</th>
              </tr>
            </thead>
            <tbody>
              {stats.byDay.map(({ date, count }) => (
                <tr key={date} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "8px" }}>{date}</td>
                  <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px" }}>🎨 Cards by Type</h2>
        {Object.keys(stats.byType).length === 0 ? (
          <div style={{ color: "#999" }}>No cards yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                <th style={{ textAlign: "left", padding: "8px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <tr key={type} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "8px" }}>{type}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      <div style={{ marginTop: "32px", textAlign: "center" }}>
        <a href="/app/shinen" style={{ color: "#5856d6", textDecoration: "underline" }}>
          ← Back to SHINEN
        </a>
      </div>
    </div>
  );
}

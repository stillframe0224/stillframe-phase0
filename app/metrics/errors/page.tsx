import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ErrorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return notFound();

  const { data: errors } = await supabase
    .from("card_errors")
    .select("id, created_at, url, error_type, error_message, status_code")
    .order("created_at", { ascending: false })
    .limit(100);

  const errorsByType = (errors || []).reduce(
    (acc, err) => {
      acc[err.error_type] = (acc[err.error_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Card Creation Errors</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Phase0 observability: track OGP fetch failures, HTTP errors, DNS blocks
      </p>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Error Summary (Last 100)</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {Object.entries(errorsByType)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <li key={type} style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
                <strong>{type}</strong>: {count} occurrences
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2>Recent Errors</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Time</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Type</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>URL</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Message</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(errors || []).map((err) => (
              <tr key={err.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "0.5rem", fontSize: "0.875rem" }}>
                  {new Date(err.created_at).toLocaleString()}
                </td>
                <td style={{ padding: "0.5rem", fontSize: "0.875rem" }}>{err.error_type}</td>
                <td style={{ padding: "0.5rem", fontSize: "0.875rem", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <a href={err.url} target="_blank" rel="noopener noreferrer">{err.url}</a>
                </td>
                <td style={{ padding: "0.5rem", fontSize: "0.875rem", maxWidth: "250px" }}>
                  {err.error_message || "-"}
                </td>
                <td style={{ padding: "0.5rem", fontSize: "0.875rem" }}>{err.status_code || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

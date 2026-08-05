/**
 * GET /api/kpi
 *
 * Simple KPI dashboard endpoint.
 * Returns card creation metrics and error rates.
 *
 * Data sources:
 *   - cards table: total cards created
 *   - error_logs table: total errors logged
 *
 * Metrics:
 *   - card_count: total cards created
 *   - error_count: total errors logged
 *   - error_rate: percentage of errors relative to total events (cards + errors)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  const ts = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        ts,
        error: "supabase_not_configured",
        notes: "Supabase env vars missing — cannot query database.",
      },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();

    // Total cards
    const { count: cardCount, error: e1 } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true });

    if (e1) {
      return NextResponse.json(
        { ok: false, ts, error: e1.message },
        { status: 200 }
      );
    }

    // Total errors
    const { count: errorCount, error: e2 } = await supabase
      .from("error_logs")
      .select("id", { count: "exact", head: true });

    if (e2) {
      return NextResponse.json(
        { ok: false, ts, error: e2.message },
        { status: 200 }
      );
    }

    const totalEvents = (cardCount ?? 0) + (errorCount ?? 0);
    const errorRate = totalEvents > 0 
      ? ((errorCount ?? 0) / totalEvents * 100).toFixed(2)
      : "0.00";

    return NextResponse.json({
      ok: true,
      ts,
      card_count: cardCount ?? 0,
      error_count: errorCount ?? 0,
      error_rate: `${errorRate}%`,
      total_events: totalEvents,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, ts, error: String(e) },
      { status: 500 }
    );
  }
}

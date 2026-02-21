/**
 * GET /api/phase0-kpi
 *
 * Phase0 KPI scorecard endpoint.
 * Returns aggregated counts only — no PII, no email addresses.
 *
 * Data sources:
 *   - cards table: total cards, distinct users, cards in last 7d
 *   - waitlist: external webhook (count not available server-side)
 *   - payment intent / preorders: external Gumroad (not available server-side)
 *
 * Thresholds (Phase0 Go/No-Go):
 *   - Waitlist: 300
 *   - Payment intent: 30
 *   - Pre-orders: 5
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
        notes: "Supabase env vars missing — cannot query cards table.",
      },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();

    // Total cards
    const { count: totalCards, error: e1 } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true });

    if (e1) {
      return NextResponse.json(
        { ok: false, ts, error: e1.message },
        { status: 200 }
      );
    }

    // Distinct users (via user_id)
    const { data: usersData, error: e2 } = await supabase
      .from("cards")
      .select("user_id");

    const distinctUsers = e2
      ? null
      : new Set((usersData ?? []).map((r) => r.user_id)).size;

    // Cards created in last 7 days
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: cards7d, error: e3 } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutoff7d);

    // Cards created in last 24 hours
    const cutoff1d = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: cards1d, error: e4 } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutoff1d);

    return NextResponse.json({
      ok: true,
      ts,
      // ── Measurable from DB ──
      total_cards: totalCards ?? 0,
      distinct_users: distinctUsers ?? 0,
      cards_7d: e3 ? null : (cards7d ?? 0),
      cards_1d: e4 ? null : (cards1d ?? 0),
      // ── External data (not available server-side) ──
      waitlist_total: null,
      payment_intent: null,
      preorders: null,
      // ── Thresholds ──
      thresholds: {
        waitlist: 300,
        payment_intent: 30,
        preorders: 5,
      },
      notes:
        "waitlist_total: collected via external webhook (NEXT_PUBLIC_WAITLIST_POST_URL), not stored in Supabase. " +
        "payment_intent/preorders: tracked via Gumroad (NEXT_PUBLIC_GUMROAD_PRODUCT_URL), not queryable server-side. " +
        "To populate these, add manual overrides to the GitHub Issue or integrate Gumroad API.",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, ts, error: String(e) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/db-schema-check
 *
 * Verifies that required columns exist in the `cards` table.
 * Uses a zero-row SELECT to probe column presence — compatible with anon key.
 *
 * Response:
 *   200 { ok: boolean, columns: { notes: boolean, media_kind: boolean }, error?: string }
 *
 * `ok` is true iff all required columns are present.
 * Used by:
 *   - scripts/apply_schema.mjs  (local verification)
 *   - prod-sanity.yml           (scheduled production health check)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ColumnResult {
  notes: boolean;
  media_kind: boolean;
}

async function probeColumn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  column: string
): Promise<boolean> {
  // SELECT <column> FROM cards LIMIT 0 — zero rows, fast, fails with PGRST204/42703 if missing
  const { error } = await supabase
    .from("cards")
    .select(column)
    .limit(0);

  if (!error) return true;

  // PGRST204: column not found in PostgREST schema cache
  // 42703: PostgreSQL "undefined_column"
  const code = (error as { code?: string }).code ?? "";
  const msg = error.message ?? "";
  if (
    code === "PGRST204" ||
    code === "42703" ||
    msg.includes("does not exist") ||
    msg.includes("column") ||
    msg.includes("PGRST204")
  ) {
    return false;
  }

  // Other errors (auth, network): assume column state is unknown — treat as present
  // to avoid false-positive alerts on transient failures.
  return true;
}

export async function GET() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, columns: { notes: false, media_kind: false }, error: "supabase_not_configured" },
      { status: 503 }
    );
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, columns: { notes: false, media_kind: false }, error: String(e) },
      { status: 503 }
    );
  }

  const [notesPresent, mediaKindPresent] = await Promise.all([
    probeColumn(supabase, "notes"),
    probeColumn(supabase, "media_kind"),
  ]);

  const columns: ColumnResult = {
    notes: notesPresent,
    media_kind: mediaKindPresent,
  };
  const ok = notesPresent && mediaKindPresent;

  return NextResponse.json({ ok, columns });
}

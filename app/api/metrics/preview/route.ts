/**
 * GET /api/metrics/preview
 *
 * Returns Instagram preview_image_url success rate for cards saved within a
 * given time window.  Uses anon key + RLS-visible SELECT — no service role
 * required.
 *
 * Query params:
 *   window  1d | 7d | 30d | all   (default: 7d)
 *
 * Response:
 *   200 {
 *     ok: boolean,
 *     window: string,
 *     instagram: {
 *       total: number,        // cards with site_name = 'Instagram' in window
 *       with_image: number,   // subset with non-null, non-empty preview_image_url
 *       null_image: number,   // subset with null/empty preview_image_url
 *       success_rate: number  // with_image / total  (null if total=0)
 *     }
 *   }
 *
 * Used by:
 *   - prod-sanity.yml  (scheduled production health check, Check 4)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Map window param to PostgreSQL interval string (or null = no filter). */
function windowToInterval(w: string): string | null {
  switch (w) {
    case "1d":  return "1 day";
    case "7d":  return "7 days";
    case "30d": return "30 days";
    case "all": return null;
    default:    return "7 days";
  }
}

interface InstagramStats {
  total: number;
  with_image: number;
  null_image: number;
  success_rate: number | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const windowParam = searchParams.get("window") ?? "7d";
  const interval = windowToInterval(windowParam);

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, window: windowParam, error: "supabase_not_configured" },
      { status: 503 }
    );
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, window: windowParam, error: String(e) },
      { status: 503 }
    );
  }

  try {
    // Build query: SELECT id, preview_image_url WHERE site_name = 'Instagram'
    // PostgREST / anon key can filter on site_name within RLS scope.
    let query = supabase
      .from("cards")
      .select("id, preview_image_url")
      .ilike("site_name", "instagram");

    if (interval) {
      // created_at >= now() - interval
      // PostgREST accepts ISO 8601 date strings in .gte(); we compute client-side.
      const cutoff = new Date(
        Date.now() - intervalToMs(interval)
      ).toISOString();
      query = query.gte("created_at", cutoff);
    }

    const { data, error } = await query;

    if (error) {
      // Column missing or auth error — return partial response rather than hard failure.
      return NextResponse.json(
        {
          ok: false,
          window: windowParam,
          error: error.message,
          instagram: null,
        },
        { status: 200 }
      );
    }

    const rows = data ?? [];
    const total = rows.length;
    const with_image = rows.filter(
      (r) => r.preview_image_url != null && r.preview_image_url !== ""
    ).length;
    const null_image = total - with_image;
    const success_rate = total > 0 ? with_image / total : null;

    const instagram: InstagramStats = {
      total,
      with_image,
      null_image,
      success_rate,
    };

    return NextResponse.json({ ok: true, window: windowParam, instagram });
  } catch (e) {
    return NextResponse.json(
      { ok: false, window: windowParam, error: String(e) },
      { status: 500 }
    );
  }
}

/** Convert interval string to milliseconds for cutoff calculation. */
function intervalToMs(interval: string): number {
  if (interval === "1 day")   return 24 * 60 * 60 * 1000;
  if (interval === "7 days")  return 7  * 24 * 60 * 60 * 1000;
  if (interval === "30 days") return 30 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000; // default 7d
}

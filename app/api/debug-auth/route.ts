import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return NextResponse.json({
    url_first20: url.slice(0, 20),
    url_length: url.length,
    key_first20: key.slice(0, 20),
    key_length: key.length,
    key_last5: key.slice(-5),
    has_whitespace: key !== key.trim(),
    has_newline: key.includes('\n') || key.includes('\r'),
  });
}

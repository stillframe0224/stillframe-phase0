import { NextResponse } from "next/server";

export async function GET() {
  const envKeys = Object.keys(process.env).filter(
    (k) => k.includes("SUPABASE") || k.includes("supabase"),
  );

  const result: Record<string, string> = {};
  for (const k of envKeys) {
    const v = process.env[k] || "";
    // Show first 10 and last 4 chars for non-empty values
    result[k] = v ? `${v.slice(0, 10)}...${v.slice(-4)} (len=${v.length})` : "(empty)";
  }

  return NextResponse.json({ envKeys: result, total: envKeys.length });
}

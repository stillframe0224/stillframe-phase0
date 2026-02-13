import { NextResponse } from "next/server";

export async function GET() {
  const patterns = ["SUPABASE", "NEXT_PUBLIC"];
  const envKeys = Object.keys(process.env).filter((k) =>
    patterns.some((p) => k.includes(p)),
  );

  const result: Record<string, string> = {};
  for (const k of envKeys) {
    const v = process.env[k] || "";
    result[k] =
      v.length > 0
        ? `${v.slice(0, 10)}...${v.slice(-4)} (len=${v.length})`
        : "(empty)";
  }

  return NextResponse.json({ envKeys: result, total: envKeys.length });
}

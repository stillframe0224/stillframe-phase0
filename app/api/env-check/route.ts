export const runtime = "nodejs";

export async function GET() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Response.json({
    VERCEL_ENV: process.env.VERCEL_ENV,
    url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: !!key,
    keyLen: key?.length ?? 0,
    keyHead: key?.slice(0, 6) ?? null,
  });
}

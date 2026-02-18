import { NextResponse } from "next/server";

// force-dynamic + nodejs runtime: reads VERCEL_GIT_COMMIT_SHA at request time (not build time)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // SHA priority:
  // 1) VERCEL_GIT_COMMIT_SHA — runtime env on Vercel (full 40-char sha, most accurate)
  // 2) NEXT_PUBLIC_GIT_SHA   — build-time injected short sha from next.config.ts
  // 3) "unknown"
  const rawSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_GIT_SHA ||
    null;
  const sha = rawSha ? rawSha.slice(0, 7) : "unknown";

  return NextResponse.json({
    sha,
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  });
}

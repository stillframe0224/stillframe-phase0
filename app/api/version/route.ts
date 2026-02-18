import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    sha: process.env.NEXT_PUBLIC_GIT_SHA ?? null,
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  });
}

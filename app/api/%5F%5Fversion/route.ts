import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    commit:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
      null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { appendFileSync } from "fs";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log to stdout (Vercel Function Logs)
    console.log(JSON.stringify(body));

    // In development, also append to local file
    if (process.env.NODE_ENV === "development") {
      try {
        const logPath = join(process.cwd(), ".rwl", "logs", "run.jsonl");
        appendFileSync(
          logPath,
          JSON.stringify({ ...body, _server_ts: new Date().toISOString() }) +
            "\n"
        );
      } catch {
        // File might not exist yet, ignore
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}

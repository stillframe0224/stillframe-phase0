import { createClient, isSupabaseConfigured } from "./client";

export interface LogCardErrorArgs {
  source: string;
  message: string;
  errorCode?: string | null;
  context?: Record<string, unknown> | null;
}

/**
 * Best-effort write to public.error_logs. Never throws or rejects;
 * callers must continue their flow regardless of persistence success.
 */
export async function logCardError({
  source,
  message,
  errorCode,
  context,
}: LogCardErrorArgs): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("error_logs").insert({
      user_id: user?.id ?? null,
      source,
      error_code: errorCode ?? null,
      message: message.slice(0, 2000),
      context: context ?? null,
      user_agent: window.navigator?.userAgent?.slice(0, 500) ?? null,
    });
  } catch {
    // Logging must not surface failures to callers.
  }
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error ?? "unknown error");
  } catch {
    return "unknown error";
  }
}

export function extractErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" || typeof code === "number") return String(code);
  }
  return null;
}

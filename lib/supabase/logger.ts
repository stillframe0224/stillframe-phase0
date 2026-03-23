/**
 * Structured error logger for Supabase operations.
 *
 * Outputs JSON to console.error for Vercel Function Logs ingestion.
 * Each entry includes: error category, operation, userId, timestamp,
 * and the original error details.
 */

export type SupabaseErrorCategory =
  | "auth"
  | "database"
  | "storage"
  | "network"
  | "validation"
  | "unknown";

interface LogEntry {
  level: "error" | "warn";
  category: SupabaseErrorCategory;
  operation: string;
  message: string;
  userId?: string | null;
  timestamp: string;
  code?: string;
  details?: unknown;
}

/**
 * Classify a Supabase/network error into a category.
 */
export function classifyError(error: unknown): SupabaseErrorCategory {
  if (!error) return "unknown";

  const msg =
    (error instanceof Error ? error.message : String(error)).toLowerCase();
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: string }).code)
      : "";

  // Auth errors
  if (
    code.startsWith("auth") ||
    msg.includes("not authenticated") ||
    msg.includes("unauthorized") ||
    msg.includes("jwt") ||
    msg.includes("session") ||
    msg.includes("refresh_token")
  ) {
    return "auth";
  }

  // Storage errors
  if (
    msg.includes("storage") ||
    msg.includes("bucket") ||
    msg.includes("upload")
  ) {
    return "storage";
  }

  // Network errors
  if (
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("abort") ||
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("dns")
  ) {
    return "network";
  }

  // Database errors (PostgreSQL error codes start with digits)
  if (
    /^\d{5}$/.test(code) ||
    code.startsWith("PGRST") ||
    msg.includes("violates") ||
    msg.includes("constraint") ||
    msg.includes("duplicate") ||
    msg.includes("relation") ||
    msg.includes("column")
  ) {
    return "database";
  }

  // Validation
  if (
    msg.includes("invalid") ||
    msg.includes("required") ||
    msg.includes("missing")
  ) {
    return "validation";
  }

  return "unknown";
}

/**
 * Log a structured Supabase error.
 */
export function logSupabaseError(
  operation: string,
  error: unknown,
  userId?: string | null,
): void {
  const category = classifyError(error);
  const entry: LogEntry = {
    level: "error",
    category,
    operation,
    message: error instanceof Error ? error.message : String(error),
    userId: userId ?? undefined,
    timestamp: new Date().toISOString(),
  };

  if (typeof error === "object" && error !== null && "code" in error) {
    entry.code = String((error as { code: string }).code);
  }

  if (typeof error === "object" && error !== null && "details" in error) {
    entry.details = (error as { details: unknown }).details;
  }

  console.error(JSON.stringify(entry));
}

/**
 * Log a structured Supabase warning (non-fatal errors).
 */
export function logSupabaseWarn(
  operation: string,
  error: unknown,
  userId?: string | null,
): void {
  const category = classifyError(error);
  const entry: LogEntry = {
    level: "warn",
    category,
    operation,
    message: error instanceof Error ? error.message : String(error),
    userId: userId ?? undefined,
    timestamp: new Date().toISOString(),
  };

  if (typeof error === "object" && error !== null && "code" in error) {
    entry.code = String((error as { code: string }).code);
  }

  console.error(JSON.stringify(entry));
}

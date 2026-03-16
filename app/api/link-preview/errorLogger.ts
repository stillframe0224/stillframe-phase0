import { createClient } from "@/lib/supabase/server";

export interface CardErrorData {
  url: string;
  error_type: string;
  error_message?: string;
  status_code?: number;
  user_agent?: string;
  request_id?: string;
  stack_trace?: string;
}

/**
 * Log card creation errors to Supabase for observability.
 * Non-blocking: errors are logged but won't fail the request.
 */
export async function logCardError(data: CardErrorData): Promise<void> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase.from("card_errors").insert({
      url: data.url,
      error_type: data.error_type,
      error_message: data.error_message?.slice(0, 1000),
      status_code: data.status_code,
      user_agent: data.user_agent?.slice(0, 500),
      request_id: data.request_id,
      stack_trace: data.stack_trace?.slice(0, 2000),
    });

    if (error) {
      console.error("[errorLogger] Failed to log card error:", error);
    }
  } catch (e) {
    console.error("[errorLogger] Exception while logging:", e);
  }
}

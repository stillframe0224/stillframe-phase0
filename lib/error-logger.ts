/**
 * Error logging utility for SHINEN Phase0
 * Records application errors to Supabase for observability
 */

import { createClient } from "@/lib/supabase/client";

export interface ErrorLogContext {
  errorType: string;          // e.g., 'card_create', 'ogp_fetch'
  errorMessage: string;
  errorStack?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an error to Supabase error_logs table
 * Non-blocking: failures are logged to console only
 */
export async function logError(context: ErrorLogContext): Promise<void> {
  try {
    const supabase = createClient();
    
    // Get current user (if authenticated)
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get session ID from sessionStorage (if available)
    const sessionId = typeof window !== 'undefined' 
      ? window.sessionStorage?.getItem('shinen_session_id') ?? null
      : null;
    
    const { error } = await supabase
      .from('error_logs')
      .insert({
        error_type: context.errorType,
        error_message: context.errorMessage,
        error_stack: context.errorStack,
        user_id: user?.id ?? null,
        session_id: sessionId,
        url: context.url ?? (typeof window !== 'undefined' ? window.location.href : null),
        metadata: context.metadata ?? {},
      });
    
    if (error) {
      console.warn('[Error Logger] Failed to log error:', error.message);
    }
  } catch (e) {
    // Never throw from error logger - just warn
    console.warn('[Error Logger] Exception while logging:', e);
  }
}

/**
 * Convenience wrapper for card creation errors
 */
export async function logCardCreateError(
  error: Error,
  cardData?: Record<string, unknown>
): Promise<void> {
  return logError({
    errorType: 'card_create',
    errorMessage: error.message,
    errorStack: error.stack,
    metadata: {
      cardData,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Convenience wrapper for OGP fetch errors
 */
export async function logOgpFetchError(
  url: string,
  error: Error,
  statusCode?: number
): Promise<void> {
  return logError({
    errorType: 'ogp_fetch',
    errorMessage: error.message,
    errorStack: error.stack,
    url,
    metadata: {
      statusCode,
      timestamp: new Date().toISOString(),
    },
  });
}

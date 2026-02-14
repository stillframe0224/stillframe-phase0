import { createBrowserClient } from "@supabase/ssr";

declare global {
  interface Window {
    __SUPABASE_CONFIG__?: { url: string; key: string };
  }
}

function getEnv() {
  const buildUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const buildKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const rt =
    typeof window !== "undefined" ? window.__SUPABASE_CONFIG__ : undefined;
  return {
    url: buildUrl || rt?.url || "",
    key: buildKey || rt?.key || "",
  };
}

export function createClient() {
  const { url, key } = getEnv();
  return createBrowserClient(url, key);
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getEnv();
  return !!(url && key);
}

export function getConfigStatus(): { url: boolean; key: boolean } {
  const { url, key } = getEnv();
  return { url: !!url, key: !!key };
}

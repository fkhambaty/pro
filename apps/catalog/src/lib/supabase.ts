import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!url || !anonKey) {
    client = null;
    return null;
  }
  client = createClient(url, anonKey);
  return client;
}

/** True when a prior session is likely in localStorage (returning visitor). */
export function hasLikelySupabaseSession(): boolean {
  try {
    return Object.keys(localStorage).some(
      (key) => key.startsWith("sb-") && key.includes("auth")
    );
  } catch {
    return false;
  }
}

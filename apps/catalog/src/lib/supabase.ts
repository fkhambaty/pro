import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAccessToken, getMemorySession } from "./sessionClient";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null | undefined;

function removeLegacyPersistedSessions(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage may be unavailable in privacy mode; this client never writes it.
  }
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!url || !anonKey) {
    client = null;
    return null;
  }
  removeLegacyPersistedSessions();
  client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    accessToken: getAccessToken,
  });

  // Existing callers use auth.getSession() to obtain a bearer token for edge
  // functions. Point that method at the receptionist's memory-only session;
  // the Supabase auth client never receives the refresh token.
  Object.defineProperty(client.auth, "getSession", {
    configurable: true,
    value: async () => ({
      data: { session: getMemorySession() },
      error: null,
    }),
  });
  return client;
}

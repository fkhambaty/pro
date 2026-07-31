import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Present only when both environment variables are set. Without them the app
 * runs on seeded demo data so the interface stays usable before any backend
 * exists.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = supabase !== null;

/** One-time fee a developer pays to unlock bidding. */
export const BIDDING_MEMBERSHIP_CENTS = 1000;

/** Charged per requirement, so posting costs a buyer something. */
export const REQUIREMENT_POSTING_CENTS = 100;

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnv, SUPABASE_KEY, SUPABASE_URL } from "./env";

/**
 * Cookie-less guest client. Safe inside `'use cache'` (which can't read cookies) and for guest
 * writes like booking requests. Row Level Security limits it to what guests may do.
 */
export function createPublicClient() {
  assertSupabaseEnv();
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

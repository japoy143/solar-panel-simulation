import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// Newer projects call it the "secret" key (sb_secret_…), older ones the "service_role" key.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";

export const isServiceConfigured = Boolean(SUPABASE_URL && SERVICE_KEY);

/**
 * Privileged client that BYPASSES Row Level Security. Only for server code that has no admin
 * session but must write admin data: the Resend webhook (inbound replies, delivery status) and
 * recording the automatic emails sent from the guest booking flow. Never use it to serve reads
 * to a request, and never import it into client code.
 */
export function createServiceClient() {
  if (!isServiceConfigured) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

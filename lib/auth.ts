import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { moduleLogger } from "@/lib/server/logger";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Only the single admin account has this role (set in SQL; users can't change app_metadata). */
export function isAdminUser(user: User | null | undefined): user is User {
  return user?.app_metadata?.role === "admin";
}

/**
 * The signed-in admin, or null for guests and non-admin accounts.
 *
 * Memoized per request with React `cache`: the admin layout gate and the page both call
 * requireAdmin(), and this keeps that to a single Supabase auth round trip. It can't use
 * `'use cache'` (it reads cookies and the clock) and isn't shared across requests, so every
 * request and Server Action still verifies the session.
 */
export const getAdmin = cache(async function getAdmin(): Promise<User | null> {
  // Request-time only. Supabase's session check compares token expiry with Date.now(), which
  // Next rejects during prerenders/prefetches (even ones where cookies are available).
  await connection();
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  // "Auth session missing" is just a guest; anything else (network, bad token) is worth a log line.
  if (error && error.name !== "AuthSessionMissingError") {
    moduleLogger("auth").warn({ name: error.name, status: error.status, msg: error.message }, "session check failed");
  }
  return isAdminUser(data.user) ? data.user : null;
});

/**
 * Data Access Layer gate: call at the top of every admin page and Server Action.
 * Redirects to the login page instead of returning when the caller isn't the admin.
 */
export async function requireAdmin(): Promise<User> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

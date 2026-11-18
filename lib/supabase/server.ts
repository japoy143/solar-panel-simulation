import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { assertSupabaseEnv, SUPABASE_KEY, SUPABASE_URL } from "./env";

/** Per-request client that carries the admin's session cookie. Use in admin pages and Server Actions. */
export async function createClient() {
  // Request-time only: never prerendered or prefetched. Supabase reads the clock (token expiry),
  // which Next forbids during prerendering.
  await connection();
  const cookieStore = await cookies();
  assertSupabaseEnv();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. proxy.ts refreshes them.
        }
      },
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { moduleLogger } from "@/lib/server/logger";
import { FLASH_COOKIE, type Flash } from "@/lib/flash";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

const log = moduleLogger("proxy");

const LOGIN = "/admin/login";

/**
 * First gate for /admin: refreshes the Supabase session cookie and sends anyone who isn't the
 * admin to the login page. Pages and Server Actions still check with requireAdmin() (lib/auth.ts),
 * and Row Level Security is the final check in the database.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const onLogin = pathname === LOGIN;
  if (!isSupabaseConfigured) {
    return onLogin ? NextResponse.next() : NextResponse.redirect(new URL(LOGIN, request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() verifies the token with Supabase (unlike getSession(), which trusts the cookie).
  // If Supabase can't be reached, fail closed: treat the visitor as signed out.
  let isAdmin = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") {
      log.warn({ path: pathname, name: error.name, status: error.status, msg: error.message }, "session check failed");
    }
    isAdmin = data.user?.app_metadata?.role === "admin";
  } catch (err) {
    log.error({ err, path: pathname }, "session check threw; treating visitor as signed out");
  }

  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c)); // keep refreshed cookies
    return res;
  };

  if (!isAdmin && !onLogin) {
    log.debug({ path: pathname }, "redirecting non-admin to login");
    const res = redirectTo(LOGIN);
    // Had a Supabase session cookie but it's no longer valid: say why they're on the login page.
    if (request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))) {
      const flash: Flash = { type: "info", message: "Your session has expired", description: "Please sign in again." };
      res.cookies.set(FLASH_COOKIE, JSON.stringify(flash), { path: "/", maxAge: 30, sameSite: "lax" });
    }
    return res;
  }
  if (isAdmin && onLogin) return redirectTo("/admin");
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};

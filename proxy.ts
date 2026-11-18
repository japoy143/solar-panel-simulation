import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

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
  const { data } = await supabase.auth.getUser();
  const isAdmin = data.user?.app_metadata?.role === "admin";

  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c)); // keep refreshed cookies
    return res;
  };

  if (!isAdmin && !onLogin) return redirectTo(LOGIN);
  if (isAdmin && onLogin) return redirectTo("/admin");
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};

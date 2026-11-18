"use server";

import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth";
import { runAction, unexpected } from "@/lib/server/action";
import { setFlash } from "@/lib/server/flash";
import { maskEmail } from "@/lib/server/logger";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; submittedAt: number };

const fail = (error: string): LoginState => ({ error, submittedAt: Date.now() });

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const ok = await runAction(
    "login",
    async ({ log }) => {
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");
      if (!email || !password) return fail("Enter your email and password.");
      if (!isSupabaseConfigured) {
        log.error("login unavailable: Supabase is not configured");
        return fail("Supabase isn't configured yet. See the README setup steps.");
      }

      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Security audit trail: failed attempts, with the email masked.
        log.warn({ user: maskEmail(email), status: error.status, code: error.code }, "admin login failed");
        // Same message for unknown email and wrong password, so it doesn't reveal which accounts exist.
        return fail("Wrong email or password.");
      }
      if (!isAdminUser(data.user)) {
        log.warn({ user: maskEmail(email) }, "login refused: account is not an admin");
        await supabase.auth.signOut();
        return fail("This account doesn't have admin access.");
      }
      log.info({ userId: data.user.id }, "admin signed in");
      return null; // success → redirect below
    },
    (ref) => fail(unexpected(ref)),
  );
  // redirect() outside the wrapper: it works by throwing and must not be treated as a failure.
  if (ok === null) {
    await setFlash({ type: "success", message: "Signed in", description: "Welcome back." });
    redirect("/admin");
  }
  return ok;
}

export async function logout() {
  const ok = await runAction(
    "logout",
    async ({ log }) => {
      const supabase = await createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        log.warn({ code: error.code, msg: error.message }, "sign-out reported an error");
        return false;
      }
      log.info("admin signed out");
      return true;
    },
    () => false, // still send them to the login page
  );
  await setFlash(
    ok
      ? { type: "success", message: "Signed out", description: "See you next time." }
      : // The session cookie is cleared either way, but say so if Supabase reported a problem.
        { type: "info", message: "Signed out on this device", description: "The server couldn't confirm it. Sign in again if anything looks off." },
  );
  redirect("/admin/login");
}

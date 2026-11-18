"use server";

import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; submittedAt: number };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const fail = (error: string): LoginState => ({ error, submittedAt: Date.now() });
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return fail("Enter your email and password.");
  if (!isSupabaseConfigured) return fail("Supabase isn't configured yet. See the README setup steps.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  // Same message for unknown email and wrong password, so it doesn't reveal which accounts exist.
  if (error) return fail("Wrong email or password.");
  if (!isAdminUser(data.user)) {
    await supabase.auth.signOut();
    return fail("This account doesn't have admin access.");
  }
  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

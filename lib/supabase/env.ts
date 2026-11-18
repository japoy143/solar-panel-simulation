/** Supabase project settings (public by design: access is enforced by Row Level Security). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Newer projects call this the "publishable" key; older ones the "anon" key. Either works.
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const PRODUCT_IMAGES_BUCKET = "product-images";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export function assertSupabaseEnv() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY) in .env.local.",
    );
  }
}

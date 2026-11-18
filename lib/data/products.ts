import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Product, ProductCategory } from "@/lib/products";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export const PRODUCTS_TAG = "products";

/** Row shape of public.products (see supabase/migrations/0001_init.sql). */
export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  summary: string;
  specs: { label: string; value: string }[] | null;
  price_cents: number | null;
  featured: boolean;
  active: boolean;
  sort_order: number;
  placement: "roof" | "wall";
  size_w: number | string;
  size_h: number | string;
  size_d: number | string;
  watts: number | string | null;
  kw: number | string | null;
  kwh: number | string | null;
  hybrid: boolean;
  images: string[] | null;
};

// Postgres `numeric` comes back as a string; normalise to numbers.
const num = (v: number | string | null) => (v == null ? undefined : Number(v));

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    summary: row.summary,
    specs: row.specs ?? [],
    priceCents: row.price_cents,
    featured: row.featured,
    active: row.active,
    sortOrder: row.sort_order,
    images: row.images ?? [],
    placement: row.placement,
    size: { w: Number(row.size_w), h: Number(row.size_h), d: Number(row.size_d) },
    watts: num(row.watts),
    kw: num(row.kw),
    kwh: num(row.kwh),
    hybrid: row.hybrid,
  };
}

/**
 * Active products for the public site and the simulator. Cached and shared by every visitor;
 * admin Server Actions call `updateTag(PRODUCTS_TAG)` so changes show up immediately.
 */
export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("hours");
  if (!isSupabaseConfigured) {
    console.warn("[products] Supabase is not configured; showing an empty catalog.");
    return [];
  }
  const { data, error } = await createPublicClient()
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`Couldn't load products: ${error.message}`);
  return (data as ProductRow[]).map(toProduct);
}

/** Every product, including inactive ones. Admin only (enforced by RLS and requireAdmin). */
export async function getAdminProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("*").order("sort_order").order("name");
  if (error) throw new Error(`Couldn't load products: ${error.message}`);
  return (data as ProductRow[]).map(toProduct);
}

export async function getAdminProduct(id: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load product: ${error.message}`);
  return data ? toProduct(data as ProductRow) : null;
}

import { PRODUCT_IMAGES_BUCKET, SUPABASE_URL } from "@/lib/supabase/env";

// Product types and client-safe helpers. Data lives in Supabase: read it on the server with
// `lib/data/products.ts`, and on the client through the catalog in `lib/catalog.ts`.

export type ProductCategory = "panel" | "inverter" | "battery";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  summary: string;
  specs: { label: string; value: string }[];
  /** Price in cents, or null when it's quoted on site. */
  priceCents: number | null;
  featured: boolean;
  active: boolean;
  /** Display order (ascending) on the site and in the simulator palette. */
  sortOrder: number;
  /** Storage paths in the product-images bucket; the first one is the cover. */
  images: string[];
  /** Simulator: where the item mounts and its footprint in metres (w along the surface, h up it, d out of it). */
  placement: "roof" | "wall";
  size: { w: number; h: number; d: number };
  /** Simulator: numeric ratings used for the layout summary. */
  watts?: number;
  kw?: number;
  kwh?: number;
  hybrid?: boolean;
};

export const categoryLabels: Record<ProductCategory, string> = {
  panel: "Solar panels",
  inverter: "Inverters",
  battery: "Batteries",
};

export const productCategories = Object.keys(categoryLabels) as ProductCategory[];

/** Public URL of an image stored in the product-images bucket. */
export function productImageUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/** The headline rating shown in lists: "410 W", "5 kW", "10 kWh". */
export function productRating(p: Pick<Product, "watts" | "kw" | "kwh">) {
  if (p.watts) return `${p.watts} W`;
  if (p.kw) return `${p.kw} kW`;
  if (p.kwh) return `${p.kwh} kWh`;
  return "—";
}

export function formatPrice(cents: number | null) {
  if (cents == null) return "Quoted";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

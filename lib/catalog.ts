import type { Product } from "./products";

// Client-side product registry. Server pages fetch the catalog from Supabase and hand it to
// <CatalogProvider>, which fills this map before any simulator code runs. Keeping it a plain
// module lets non-React code (the zustand store, layout summary, placement math) look products
// up synchronously, exactly as it did with the old hard-coded list.

let bySlug = new Map<string, Product>();
let list: Product[] = [];

export function setCatalog(products: Product[]) {
  list = products;
  bySlug = new Map(products.map((p) => [p.slug, p]));
}

export function getCatalog(): Product[] {
  return list;
}

export function getProduct(slug: string): Product | undefined {
  return bySlug.get(slug);
}

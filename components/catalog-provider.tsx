"use client";

import type { ReactNode } from "react";
import { setCatalog } from "@/lib/catalog";
import type { Product } from "@/lib/products";

/**
 * Loads the server-fetched catalog into the client registry (lib/catalog.ts) before children
 * render. Idempotent: it's the same public catalog for every visitor.
 */
export function CatalogProvider({ products, children }: { products: Product[]; children: ReactNode }) {
  setCatalog(products);
  return children;
}

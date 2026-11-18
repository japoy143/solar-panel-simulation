import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { ProductForm } from "@/components/admin/product-form";
import { getAdminProducts } from "@/lib/data/products";

// Admin pages check the session and load live data on every request, so they block on the
// server by design. Opt out of instant-navigation validation (see docs: instant-navigation#opting-out).
export const instant = false;

export default async function NewProductPage() {
  await requireAdmin();
  const products = await getAdminProducts();
  const nextSortOrder = Math.max(0, ...products.map((p) => p.sortOrder)) + 10;
  return (
    <>
      <PageHeader eyebrow="Catalog" title="Add product" description="It appears on the site as soon as it's active." />
      <ProductForm nextSortOrder={nextSortOrder} />
    </>
  );
}

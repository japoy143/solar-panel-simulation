import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { ProductForm } from "@/components/admin/product-form";
import { getAdminProducts } from "@/lib/data/products";

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

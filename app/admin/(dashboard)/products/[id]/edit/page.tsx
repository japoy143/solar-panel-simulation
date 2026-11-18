import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { getAdminProduct } from "@/lib/data/products";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]/edit">) {
  await requireAdmin();
  const { id } = await params;
  const product = UUID.test(id) ? await getAdminProduct(id) : null;
  if (!product) notFound();
  return (
    <>
      <PageHeader eyebrow="Catalog" title={`Edit ${product.name}`} />
      <ProductForm key={product.id} product={product} />
    </>
  );
}

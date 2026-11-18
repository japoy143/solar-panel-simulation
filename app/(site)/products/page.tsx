import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/components/site/product-card";
import { getProducts } from "@/lib/data/products";
import { categoryLabels, productCategories } from "@/lib/products";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Products · Solar Layout Simulator",
};

export default async function ProductsPage() {
  const products = await getProducts();
  const categories = productCategories.filter((c) => products.some((p) => p.category === c));
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="max-w-2xl space-y-4">
        <p className="eyebrow text-primary-strong">Products</p>
        <h1 className="text-4xl font-semibold text-balance sm:text-5xl">
          Equipment we install
        </h1>
        <p className="text-lg text-muted-foreground">
          Panels, inverters, and batteries we size to your roof and energy use.
        </p>
      </div>

      <nav aria-label="Product categories" className="mt-10 flex flex-wrap gap-2">
        {categories.map((category) => (
          <Link
            key={category}
            href={`#${category}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-3")}
          >
            {categoryLabels[category]}
          </Link>
        ))}
      </nav>

      {products.length === 0 && (
        <p className="mt-16 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Our catalog is being updated. Check back soon.
        </p>
      )}

      <div className="mt-16 space-y-20">
        {categories.map((category) => (
          <section key={category} id={category} className="scroll-mt-24 space-y-8">
            <h2 className="border-b pb-4 text-2xl font-semibold">
              {categoryLabels[category]}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products
                .filter((p) => p.category === category)
                .map((product) => (
                  <ProductCard key={product.slug} product={product} />
                ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-20 flex flex-col items-start justify-between gap-6 rounded-2xl border bg-muted/40 px-6 py-10 sm:flex-row sm:items-center sm:px-10">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Not sure what you need?</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll recommend a system during your free site assessment.
          </p>
        </div>
        <Link href="/booking" className={cn(buttonVariants(), "h-10 px-5")}>
          Book assessment
          <ArrowRightIcon data-icon="inline-end" />
        </Link>
      </div>
    </div>
  );
}

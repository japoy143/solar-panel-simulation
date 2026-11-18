import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { categoryLabels, formatPrice, type Product } from "@/lib/products";
import { ProductGallery } from "./product-gallery";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="h-full gap-5 pt-0">
      <ProductGallery product={product} />

      <CardHeader>
        <p className="eyebrow text-primary-strong">{categoryLabels[product.category]}</p>
        <CardTitle className="text-lg font-semibold">{product.name}</CardTitle>
        <p className="font-mono text-sm text-primary-strong">{formatPrice(product.priceCents)}</p>
        <CardDescription>{product.summary}</CardDescription>
      </CardHeader>

      <CardContent className="mt-auto">
        <dl className="grid grid-cols-3 gap-3 border-t pt-4">
          {product.specs.map((spec) => (
            <div key={spec.label} className="space-y-1">
              <dt className="eyebrow text-muted-foreground">{spec.label}</dt>
              <dd className="font-medium">{spec.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

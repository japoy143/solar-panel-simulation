import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { BatteryFullIcon, PackageIcon, PlusIcon, SunIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { getAdminProducts } from "@/lib/data/products";
import { categoryLabels, formatPrice, productImageUrl, productRating } from "@/lib/products";
import { cn } from "@/lib/utils";

const categoryIcons = { panel: SunIcon, inverter: ZapIcon, battery: BatteryFullIcon } as const;

export default async function AdminProductsPage() {
  await requireAdmin();
  const products = await getAdminProducts();

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Panels, inverters, and batteries offered to customers."
        action={
          <Link href="/admin/products/new" className={cn(buttonVariants(), "h-9 px-4")}>
            <PlusIcon data-icon="inline-start" />
            Add product
          </Link>
        }
      />

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <PackageIcon className="size-6 text-primary" />
                    <p className="font-medium text-foreground">No products yet</p>
                    <Link href="/admin/products/new" className="text-sm text-primary-strong hover:underline">
                      Add your first product
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const Icon = categoryIcons[p.category];
                return (
                  <TableRow key={p.id} className={cn(!p.active && "text-muted-foreground")}>
                    <TableCell className="pl-4">
                      <Link href={`/admin/products/${p.id}/edit`} className="flex items-center gap-3 hover:underline">
                        {p.images[0] ? (
                          <Image
                            src={productImageUrl(p.images[0])}
                            alt=""
                            width={40}
                            height={40}
                            className={cn("size-10 rounded-md bg-muted object-cover", !p.active && "opacity-50")}
                          />
                        ) : (
                          <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Icon className="size-4" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block font-mono text-xs text-muted-foreground">{p.slug}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>{categoryLabels[p.category]}</TableCell>
                    <TableCell className="font-mono text-sm">{productRating(p)}</TableCell>
                    <TableCell className="font-mono text-sm">{formatPrice(p.priceCents)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Active" : "Hidden"}</Badge>
                        {p.featured && <Badge variant="outline">Featured</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <ProductRowActions id={p.id} name={p.name} active={p.active} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

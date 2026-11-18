"use client";

import { useState } from "react";
import Image from "next/image";
import { BatteryFullIcon, SunIcon, ZapIcon } from "lucide-react";
import { productImageUrl, type Product } from "@/lib/products";
import { cn } from "@/lib/utils";

const categoryIcons = { panel: SunIcon, inverter: ZapIcon, battery: BatteryFullIcon } as const;

/** Product picture with thumbnails to switch between images; icon placeholder when there are none. */
export function ProductGallery({ product }: { product: Product }) {
  const [index, setIndex] = useState(0);
  const Icon = categoryIcons[product.category];
  const images = product.images;

  if (images.length === 0) {
    return (
      <div className="flex aspect-4/3 items-center justify-center border-b bg-linear-to-b from-primary/10 to-muted/40">
        <span className="flex size-14 items-center justify-center rounded-xl bg-background text-primary ring-1 ring-foreground/10">
          <Icon className="size-6" />
        </span>
      </div>
    );
  }

  return (
    <div className="border-b">
      <div className="relative aspect-4/3 overflow-hidden bg-muted">
        <Image
          src={productImageUrl(images[Math.min(index, images.length - 1)])}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3" role="group" aria-label={`${product.name} photos`}>
          {images.map((path, i) => (
            <button
              key={path}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={i === index}
              className={cn(
                "relative size-12 shrink-0 overflow-hidden rounded-md ring-1 ring-foreground/10 transition",
                i === index ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
              )}
            >
              <Image src={productImageUrl(path)} alt="" fill sizes="48px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

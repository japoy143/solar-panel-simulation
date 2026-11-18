import { getProduct } from "@/lib/catalog";
import type { MountSurface } from "@/lib/simulator/buildings";
import { resolvePlacement, worldToSurface, type PlacedItem } from "@/lib/simulator/geometry";
import type { Ghost } from "@/lib/simulator/store";
import type { Vec3 } from "@/lib/simulator/vec";

/** Preview where `slug` would land if dropped at world `point` on `surface`. */
export function ghostAt(
  slug: string,
  surface: MountSurface,
  point: Vec3,
  items: PlacedItem[],
): Ghost | null {
  const product = getProduct(slug);
  if (!product || product.placement !== surface.kind) return null;
  const local = worldToSurface(surface, point);
  const placement = resolvePlacement({
    surface,
    product,
    rotation: 0,
    u: local.u,
    v: local.v,
    items,
    getProduct,
  });
  return { slug, surfaceId: surface.id, rotation: 0, ...placement };
}

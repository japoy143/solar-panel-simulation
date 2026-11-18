import type { Product } from "@/lib/products";
import type { MountSurface } from "./buildings";
import { add, dot, scale, sub, type Vec3 } from "./vec";

export type Rotation = 0 | 90;

export type PlacedItem = {
  id: string;
  slug: string;
  surfaceId: string;
  u: number;
  v: number;
  rotation: Rotation;
};

export type Placement = { u: number; v: number; valid: boolean };

/** Space kept between neighbouring panels. */
export const PANEL_GAP = 0.02;
/** Distance between the surface and the back of a mounted item. */
export const STANDOFF = 0.06;
const WALL_STEP = 0.05;

export function footprint(product: Product, rotation: Rotation) {
  return rotation === 90
    ? { w: product.size.h, h: product.size.w }
    : { w: product.size.w, h: product.size.h };
}

export function worldToSurface(surface: MountSurface, point: Vec3) {
  const rel = sub(point, surface.origin);
  return { u: dot(rel, surface.uAxis), v: dot(rel, surface.vAxis) };
}

/** World position of an item's centre (lifted off the surface by standoff + half its depth). */
export function surfaceToWorld(surface: MountSurface, u: number, v: number, lift = 0): Vec3 {
  return add(
    add(surface.origin, add(scale(surface.uAxis, u), scale(surface.vAxis, v))),
    scale(surface.normal, lift),
  );
}

function rowPitch(surface: MountSurface, h: number) {
  return h + (surface.rowGap ?? PANEL_GAP);
}

/** Snap to the panel grid (anchored at the surface's lower-left corner) or a fine wall grid. */
export function snap(surface: MountSurface, product: Product, rotation: Rotation, u: number, v: number) {
  const { w, h } = footprint(product, rotation);
  if (product.category !== "panel") {
    return { u: Math.round(u / WALL_STEP) * WALL_STEP, v: Math.round(v / WALL_STEP) * WALL_STEP };
  }
  const u0 = -surface.width / 2 + w / 2;
  const v0 = -surface.height / 2 + h / 2;
  const pu = w + PANEL_GAP;
  const pv = rowPitch(surface, h);
  return {
    u: u0 + Math.round((u - u0) / pu) * pu,
    v: v0 + Math.round((v - v0) / pv) * pv,
  };
}

export function fitsSurface(surface: MountSurface, product: Product, rotation: Rotation) {
  const { w, h } = footprint(product, rotation);
  return product.placement === surface.kind && w <= surface.width && h <= surface.height;
}

export function clamp(surface: MountSurface, product: Product, rotation: Rotation, u: number, v: number) {
  const { w, h } = footprint(product, rotation);
  const mu = Math.max(0, surface.width / 2 - w / 2);
  const mv = Math.max(0, surface.height / 2 - h / 2);
  return { u: Math.min(mu, Math.max(-mu, u)), v: Math.min(mv, Math.max(-mv, v)) };
}

type Rect = { u: number; v: number; w: number; h: number };

/** True if every corner of `rect` is inside the surface's convex outline (or there is none). */
export function insideOutline(surface: MountSurface, rect: Rect) {
  const outline = surface.outline;
  if (!outline) return true;
  const corners: [number, number][] = [
    [rect.u - rect.w / 2, rect.v - rect.h / 2],
    [rect.u + rect.w / 2, rect.v - rect.h / 2],
    [rect.u + rect.w / 2, rect.v + rect.h / 2],
    [rect.u - rect.w / 2, rect.v + rect.h / 2],
  ];
  return corners.every(([px, py]) =>
    outline.every(([ax, ay], i) => {
      const [bx, by] = outline[(i + 1) % outline.length];
      // Outline is counter-clockwise, so inside points are on the left of every edge.
      return (bx - ax) * (py - ay) - (by - ay) * (px - ax) >= -1e-6;
    }),
  );
}

function overlaps(a: Rect, b: Rect) {
  const eps = 0.005;
  return (
    Math.abs(a.u - b.u) < (a.w + b.w) / 2 - eps && Math.abs(a.v - b.v) < (a.h + b.h) / 2 - eps
  );
}

export function collides(
  rect: Rect,
  surfaceId: string,
  items: PlacedItem[],
  getProduct: (slug: string) => Product | undefined,
  ignoreId?: string,
) {
  return items.some((item) => {
    if (item.surfaceId !== surfaceId || item.id === ignoreId) return false;
    const p = getProduct(item.slug);
    if (!p) return false;
    return overlaps(rect, { u: item.u, v: item.v, ...footprint(p, item.rotation) });
  });
}

/** Snap + clamp a raw (u, v) and report whether the result is a legal spot. */
export function resolvePlacement(args: {
  surface: MountSurface;
  product: Product;
  rotation: Rotation;
  u: number;
  v: number;
  items: PlacedItem[];
  getProduct: (slug: string) => Product | undefined;
  ignoreId?: string;
}): Placement {
  const { surface, product, rotation, items, getProduct, ignoreId } = args;
  if (!fitsSurface(surface, product, rotation)) return { u: args.u, v: args.v, valid: false };
  const snapped = snap(surface, product, rotation, args.u, args.v);
  const { u, v } = clamp(surface, product, rotation, snapped.u, snapped.v);
  const rect = { u, v, ...footprint(product, rotation) };
  return {
    u,
    v,
    valid: insideOutline(surface, rect) && !collides(rect, surface.id, items, getProduct, ignoreId),
  };
}

/** Fill every free grid slot on a roof surface with `product`. Returns only the new items. */
export function autoFill(args: {
  surface: MountSurface;
  product: Product;
  rotation: Rotation;
  items: PlacedItem[];
  getProduct: (slug: string) => Product | undefined;
  makeId: () => string;
}): PlacedItem[] {
  const { surface, product, rotation, getProduct, makeId } = args;
  if (!fitsSurface(surface, product, rotation)) return [];
  const { w, h } = footprint(product, rotation);
  const pu = w + PANEL_GAP;
  const pv = rowPitch(surface, h);
  const cols = Math.floor((surface.width + PANEL_GAP) / pu);
  const rows = Math.floor((surface.height + (surface.rowGap ?? PANEL_GAP)) / pv);
  // Centre the block on the surface instead of hugging the corner.
  const startU = -((cols - 1) * pu) / 2;
  const startV = -((rows - 1) * pv) / 2;

  const placed = [...args.items];
  const added: PlacedItem[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = startU + c * pu;
      const v = startV + r * pv;
      const rect = { u, v, w, h };
      if (!insideOutline(surface, rect) || collides(rect, surface.id, placed, getProduct)) continue;
      const item: PlacedItem = { id: makeId(), slug: product.slug, surfaceId: surface.id, u, v, rotation };
      placed.push(item);
      added.push(item);
    }
  }
  return added;
}

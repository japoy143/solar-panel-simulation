"use client";

import { useMemo, type ReactNode } from "react";
import type { Product } from "@/lib/products";
import type { MountSurface } from "@/lib/simulator/buildings";
import { footprint, STANDOFF, surfaceToWorld, type Rotation } from "@/lib/simulator/geometry";
import { surfaceQuaternion } from "./theme";

/** Places children (a ProductModel) at (u, v) on a surface, applying rotation and rack tilt. */
export function Mounted({
  surface,
  product,
  u,
  v,
  rotation,
  children,
}: {
  surface: MountSurface;
  product: Product;
  u: number;
  v: number;
  rotation: Rotation;
  children: ReactNode;
}) {
  const quaternion = useMemo(() => surfaceQuaternion(surface), [surface]);
  const tilt = product.category === "panel" ? ((surface.panelTilt ?? 0) * Math.PI) / 180 : 0;
  const { h } = footprint(product, rotation);
  const lift = STANDOFF + product.size.d / 2 + (Math.sin(tilt) * h) / 2;
  const position = surfaceToWorld(surface, u, v, lift);

  return (
    <group position={position} quaternion={quaternion}>
      <group rotation={[tilt, 0, 0]}>
        <group rotation={[0, rotation === 90 ? Math.PI / 2 : 0, 0]}>{children}</group>
      </group>
    </group>
  );
}

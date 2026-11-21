"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Product } from "@/lib/products";
import { getBuilding, type BuildingId } from "@/lib/simulator/buildings";
import type { PlacedItem } from "@/lib/simulator/geometry";
import { BuildingModel } from "./building-model";
import { Mounted } from "./mounted";
import { ProductModel } from "./product-model";
import { useSceneColors } from "./theme";

export type LayoutPreviewProps = {
  buildingId: BuildingId;
  items: PlacedItem[];
  /** Products referenced by the items; items whose product is missing are skipped. */
  products: Product[];
};

/**
 * Read-only 3D view of a saved layout (e.g. one attached to a booking). Uses the simulator's own
 * building and product models, but none of its store: drag to orbit, nothing can be edited.
 * Load it through layout-preview-loader.tsx (three.js needs the browser).
 */
export default function LayoutPreview({ buildingId, items, products }: LayoutPreviewProps) {
  const colors = useSceneColors();
  const building = getBuilding(buildingId);
  const surfaces = useMemo(() => new Map(building.surfaces.map((s) => [s.id, s])), [building]);
  const bySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);

  return (
    <Canvas
      shadows
      // Static scene: only re-render when the user orbits.
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 40, near: 0.1, far: 500, position: building.camera.position }}
    >
      <color attach="background" args={[colors.gray50]} />
      <hemisphereLight args={[colors.white, colors.gray200, 1.2]} />
      <directionalLight
        castShadow
        position={[25, 40, 20]}
        intensity={2.2}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-bias={-0.0005}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color={colors.gray100} roughness={1} />
      </mesh>

      <BuildingModel building={building} colors={colors} />
      {items.map((item) => {
        const surface = surfaces.get(item.surfaceId);
        const product = bySlug.get(item.slug);
        if (!surface || !product) return null;
        return (
          <Mounted key={item.id} surface={surface} product={product} u={item.u} v={item.v} rotation={item.rotation}>
            <ProductModel product={product} colors={colors} />
          </Mounted>
        );
      })}

      <OrbitControls
        makeDefault
        target={building.camera.target}
        enableDamping
        // Page scrolling must keep working over the preview, so no wheel zoom or panning.
        enableZoom={false}
        enablePan={false}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </Canvas>
  );
}

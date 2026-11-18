"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, BufferGeometry, DoubleSide, Float32BufferAttribute, MeshStandardMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Building, BuildingBox, BuildingPolygon } from "@/lib/simulator/buildings";
import type { SceneColors } from "./theme";

type MaterialKey = BuildingBox["material"];
const MATERIALS: MaterialKey[] = ["wall", "roof", "glass", "trim"];

function polygonGeometry(poly: BuildingPolygon) {
  // Fan-triangulate the (convex) polygon.
  const positions: number[] = [];
  for (let i = 1; i < poly.points.length - 1; i++) {
    positions.push(...poly.points[0], ...poly.points[i], ...poly.points[i + 1]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function boxGeometry(box: BuildingBox) {
  // Match the polygon layout (non-indexed, position + normal) so everything can be merged.
  const geometry = new BoxGeometry(...box.size).toNonIndexed();
  geometry.deleteAttribute("uv");
  geometry.translate(...box.position);
  return geometry;
}

/**
 * Bake every box and polygon into one geometry per material, so a building is at most
 * four draw calls (and four shadow passes) no matter how detailed it is.
 */
function mergeBuilding(building: Building) {
  const parts = new Map<MaterialKey, BufferGeometry[]>();
  const push = (key: MaterialKey, g: BufferGeometry) => parts.set(key, [...(parts.get(key) ?? []), g]);
  building.boxes.forEach((b) => push(b.material, boxGeometry(b)));
  building.polygons.forEach((p) => push(p.material, polygonGeometry(p)));

  return MATERIALS.flatMap((key) => {
    const list = parts.get(key);
    if (!list) return [];
    const geometry = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    return geometry ? [{ key, geometry }] : [];
  });
}

export function BuildingModel({ building, colors }: { building: Building; colors: SceneColors }) {
  const meshes = useMemo(() => mergeBuilding(building), [building]);
  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes]);

  const materials = useMemo(() => {
    const glass = { roughness: 0.15, metalness: 0.4 };
    const matte = { roughness: 0.88, metalness: 0 };
    const m: Record<MaterialKey, MeshStandardMaterial> = {
      // DoubleSide: roof and gable polygons are single planes seen from both sides.
      wall: new MeshStandardMaterial({ color: colors.white, side: DoubleSide, ...matte }),
      roof: new MeshStandardMaterial({ color: colors.roof, side: DoubleSide, ...matte }),
      glass: new MeshStandardMaterial({ color: colors.roof, ...glass }),
      trim: new MeshStandardMaterial({ color: colors.gray500, ...matte }),
    };
    return m;
  }, [colors]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  return (
    <group>
      {meshes.map(({ key, geometry }) => {
        // Glass and trim are thin decals on the facade: skip them in the shadow pass.
        const flat = key === "glass" || key === "trim";
        return (
          <mesh
            key={key}
            geometry={geometry}
            material={materials[key]}
            castShadow={!flat}
            receiveShadow
          />
        );
      })}
    </group>
  );
}

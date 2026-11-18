"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  Euler,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  Quaternion,
  QuadraticBezierCurve3,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { getProduct } from "@/lib/catalog";
import type { Product } from "@/lib/products";
import type { Building, MountSurface } from "@/lib/simulator/buildings";
import { footprint, STANDOFF, surfaceToWorld, type PlacedItem } from "@/lib/simulator/geometry";
import { add, scale, type Vec3 } from "@/lib/simulator/vec";
import { surfaceQuaternion, type SceneColors } from "./theme";

const PULSES_PER_PATH = 6;
/** Pulse travel speed in metres per second (paths of any length look equally lively). */
const PULSE_SPEED = 3.2;

type Placed = { item: PlacedItem; product: Product; surface: MountSurface };

/** Same transform `Mounted` applies, so glows sit exactly on the panel glass. */
function panelTransform({ item, product, surface }: Placed) {
  const tilt = ((surface.panelTilt ?? 0) * Math.PI) / 180;
  const { h } = footprint(product, item.rotation);
  const lift = STANDOFF + product.size.d / 2 + (Math.sin(tilt) * h) / 2;
  const quaternion = surfaceQuaternion(surface)
    .multiply(new Quaternion().setFromEuler(new Euler(tilt, 0, 0)))
    .multiply(new Quaternion().setFromEuler(new Euler(0, item.rotation === 90 ? Math.PI / 2 : 0, 0)));
  const centre = new Vector3(...surfaceToWorld(surface, item.u, item.v, lift));
  // Top face of the panel (local +Y), nudged off the glass to avoid z-fighting.
  const top = centre.clone().add(new Vector3(0, product.size.d / 2 + 0.008, 0).applyQuaternion(quaternion));
  return { top, quaternion };
}

/** Front face centre of a wall-mounted cabinet. */
function cabinetFront({ item, product, surface }: Placed): Vec3 {
  const centre = surfaceToWorld(surface, item.u, item.v, STANDOFF + product.size.d / 2);
  return add(centre, scale(surface.normal, product.size.d / 2 + 0.02));
}

/** A gentle arc between two points: rises with distance and bulges out of the building. */
function arc(from: Vector3, to: Vector3, outward: Vector3) {
  const dist = from.distanceTo(to);
  const control = from
    .clone()
    .lerp(to, 0.5)
    .add(new Vector3(0, Math.min(3, 0.2 * dist + 0.4), 0))
    .addScaledVector(outward, Math.min(2, 0.15 * dist));
  return new QuadraticBezierCurve3(from, control, to);
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * "Harvesting energy" effect for a fully assembled system: a light wave sweeps the panels and
 * glowing pulses travel panels → inverter → batteries. Everything is instanced (2 draw calls for
 * all glows and pulses, plus one per cable), and frames are only requested while it's mounted.
 */
export function EnergyFlow({
  building,
  items,
  colors,
}: {
  building: Building;
  items: PlacedItem[];
  colors: SceneColors;
}) {
  const reducedMotion = usePrefersReducedMotion();

  const scene = useMemo(() => {
    const surfaces = new Map(building.surfaces.map((s) => [s.id, s]));
    const placed: Placed[] = items.flatMap((item) => {
      const product = getProduct(item.slug);
      const surface = surfaces.get(item.surfaceId);
      return product && surface ? [{ item, product, surface }] : [];
    });
    const panels = placed.filter((p) => p.product.category === "panel");
    const inverters = placed.filter((p) => p.product.category === "inverter");
    const batteries = placed.filter((p) => p.product.category === "battery");
    if (panels.length === 0 || inverters.length === 0) return null;

    const glows = panels.map((p) => {
      const { top, quaternion } = panelTransform(p);
      const { w, h } = p.product.size;
      return { top, quaternion, w: w - 0.06, h: h - 0.06, phase: p.item.u * 0.9 + p.item.v * 0.6 };
    });

    // One cable per roof face, from that face's panel centroid to the nearest inverter.
    const bySurface = new Map<string, { g: (typeof glows)[number] }[]>();
    glows.forEach((g, i) => {
      const id = panels[i].surface.id;
      bySurface.set(id, [...(bySurface.get(id) ?? []), { g }]);
    });
    const inverterPoints = inverters.map((inv) => ({ point: new Vector3(...cabinetFront(inv)), inv }));
    const curves: QuadraticBezierCurve3[] = [];
    for (const group of bySurface.values()) {
      const centroid = group
        .reduce((sum, { g }) => sum.add(g.top), new Vector3())
        .divideScalar(group.length);
      const target = inverterPoints.reduce((best, c) =>
        c.point.distanceTo(centroid) < best.point.distanceTo(centroid) ? c : best,
      );
      curves.push(arc(centroid, target.point, new Vector3(...target.inv.surface.normal)));
    }
    // Then inverter → each battery.
    for (const bat of batteries) {
      const to = new Vector3(...cabinetFront(bat));
      const from = inverterPoints.reduce((best, c) =>
        c.point.distanceTo(to) < best.point.distanceTo(to) ? c : best,
      );
      curves.push(arc(from.point, to, new Vector3(...bat.surface.normal)));
    }

    return {
      glows,
      curves,
      lengths: curves.map((c) => c.getLength()),
      tubes: curves.map((c) => new TubeGeometry(c, 48, 0.022, 6, false)),
    };
  }, [building, items]);

  // Shared geometries, created once.
  const plane = useMemo(() => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const sphere = useMemo(() => new SphereGeometry(1, 10, 8), []);
  useEffect(() => () => scene?.tubes.forEach((t) => t.dispose()), [scene]);
  useEffect(
    () => () => {
      plane.dispose();
      sphere.dispose();
    },
    [plane, sphere],
  );

  const glowRef = useRef<InstancedMesh>(null);
  const pulseRef = useRef<InstancedMesh>(null);
  const haloRef = useRef<InstancedMesh>(null);
  const green = useMemo(() => new Color(colors.green), [colors]);

  // Static per-instance transforms for the panel glows.
  useLayoutEffect(() => {
    const mesh = glowRef.current;
    if (!mesh || !scene) return;
    const o = new Object3D();
    scene.glows.forEach((g, i) => {
      o.position.copy(g.top);
      o.quaternion.copy(g.quaternion);
      o.scale.set(g.w, 1, g.h);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, green);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [scene, green]);

  const tmp = useMemo(() => ({ o: new Object3D(), c: new Color(), p: new Vector3() }), []);

  useFrame((state) => {
    if (!scene) return;
    const t = reducedMotion ? 1.2 : state.clock.elapsedTime;
    const { o, c, p } = tmp;

    // A bright band sweeping across the array, over a soft base glow.
    const glow = glowRef.current;
    if (glow) {
      scene.glows.forEach((g, i) => {
        const wave = Math.max(0, Math.sin(t * 2.2 - g.phase));
        glow.setColorAt(i, c.copy(green).multiplyScalar(0.12 + 0.55 * wave ** 6));
      });
      if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
    }

    // Evenly spaced pulses travelling along each cable; they swell mid-flight.
    const pulse = pulseRef.current;
    const halo = haloRef.current;
    if (pulse && halo) {
      let n = 0;
      scene.curves.forEach((curve, ci) => {
        const speed = PULSE_SPEED / scene.lengths[ci];
        for (let k = 0; k < PULSES_PER_PATH; k++) {
          const f = (t * speed + k / PULSES_PER_PATH) % 1;
          curve.getPointAt(f, p);
          const s = 0.055 + 0.04 * Math.sin(f * Math.PI);
          o.position.copy(p);
          o.quaternion.identity();
          o.scale.setScalar(s);
          o.updateMatrix();
          pulse.setMatrixAt(n, o.matrix);
          o.scale.setScalar(s * 2.6);
          o.updateMatrix();
          halo.setMatrixAt(n, o.matrix);
          n++;
        }
      });
      pulse.instanceMatrix.needsUpdate = true;
      halo.instanceMatrix.needsUpdate = true;
    }

    // The canvas renders on demand; keep frames coming only while the animation runs.
    if (!reducedMotion) state.invalidate();
  });

  if (!scene) return null;
  const pulseCount = scene.curves.length * PULSES_PER_PATH;

  return (
    <group>
      <instancedMesh
        key={`glow-${scene.glows.length}`}
        ref={glowRef}
        args={[plane, undefined, scene.glows.length]}
        raycast={() => null}
      >
        <meshBasicMaterial
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </instancedMesh>

      {scene.tubes.map((tube, i) => (
        <mesh key={i} geometry={tube} raycast={() => null}>
          <meshBasicMaterial color={colors.green} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      <instancedMesh
        key={`pulse-${pulseCount}`}
        ref={pulseRef}
        args={[sphere, undefined, pulseCount]}
        raycast={() => null}
        frustumCulled={false}
      >
        <meshBasicMaterial color={colors.green} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        key={`halo-${pulseCount}`}
        ref={haloRef}
        args={[sphere, undefined, pulseCount]}
        raycast={() => null}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color={colors.green}
          transparent
          opacity={0.25}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

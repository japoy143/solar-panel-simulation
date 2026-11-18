"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { Group, Plane, PlaneGeometry, Raycaster, Shape, ShapeGeometry, Vector2, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { getProduct } from "@/lib/catalog";
import type { Building, MountSurface } from "@/lib/simulator/buildings";
import { resolvePlacement, worldToSurface, type PlacedItem } from "@/lib/simulator/geometry";
import { currentItems, useSimulator } from "@/lib/simulator/store";
import type { Vec3 } from "@/lib/simulator/vec";
import { summarize } from "@/lib/simulator/summary";
import { BuildingModel } from "./building-model";
import { EnergyFlow } from "./energy-flow";
import { Mounted } from "./mounted";
import { ghostAt } from "./place";
import { ProductModel } from "./product-model";
import { planeQuaternion, useSceneColors, type SceneColors } from "./theme";

export type SceneHandle = {
  /** Raycast from screen coords onto mount surfaces of the given kind. */
  pick: (clientX: number, clientY: number, kind: MountSurface["kind"]) => {
    surface: MountSurface;
    point: Vec3;
  } | null;
  resetView: () => void;
};

export function Scene({ building, ref }: { building: Building; ref: Ref<SceneHandle> }) {
  const colors = useSceneColors();
  const select = useSimulator((s) => s.select);

  return (
    <Canvas
      shadows
      // Nothing animates on its own: render only when the camera, store or pointer changes.
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 40, near: 0.1, far: 500, position: building.camera.position }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={[colors.gray50]} />
      <hemisphereLight args={[colors.white, colors.gray200, 1.2]} />
      <directionalLight
        castShadow
        position={[25, 40, 20]}
        intensity={2.2}
        shadow-mapSize={[2048, 2048]}
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
      <Grid
        position={[0, 0.01, 0]}
        args={[200, 200]}
        cellSize={1}
        sectionSize={5}
        cellColor={colors.gray200}
        sectionColor={colors.gray200}
        fadeDistance={110}
        infiniteGrid
      />

      <BuildingModel building={building} colors={colors} />
      <SceneContent building={building} colors={colors} handleRef={ref} />

      <OrbitControls
        makeDefault
        enableDamping
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={5}
        maxDistance={110}
      />
    </Canvas>
  );
}

function SceneContent({
  building,
  colors,
  handleRef,
}: {
  building: Building;
  colors: SceneColors;
  handleRef: Ref<SceneHandle>;
}) {
  const items = useSimulator(currentItems);
  const ghost = useSimulator((s) => s.ghost);
  const pendingSlug = useSimulator((s) => s.pendingSlug);
  const targetsRef = useRef<Group>(null);
  const { camera, gl } = useThree();
  // Portrait (phone) canvases need the camera further back to fit the building's width.
  const portrait = useThree((s) => s.size.width < s.size.height);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;

  const surfaces = useMemo(
    () => new Map(building.surfaces.map((s) => [s.id, s])),
    [building],
  );
  const pendingKind = pendingSlug ? getProduct(pendingSlug)?.placement : undefined;
  const live = useMemo(() => summarize(items).live, [items]);

  const framePosition = useMemo(() => {
    const [x, y, z] = building.camera.position;
    const k = portrait ? 1.6 : 1;
    return [x * k, y * k, z * k] as Vec3;
  }, [building, portrait]);

  // Frame the camera on each building.
  useEffect(() => {
    camera.position.set(...framePosition);
    if (controls) {
      controls.target.set(...building.camera.target);
      controls.update();
    }
  }, [building, camera, controls, framePosition]);

  useImperativeHandle(
    handleRef,
    () => ({
      pick(clientX, clientY, kind) {
        const group = targetsRef.current;
        if (!group) return null;
        const rect = gl.domElement.getBoundingClientRect();
        const ndc = new Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1,
        );
        const raycaster = new Raycaster();
        raycaster.setFromCamera(ndc, camera);
        for (const hit of raycaster.intersectObjects(group.children, false)) {
          const surface = surfaces.get(hit.object.userData.surfaceId as string);
          if (surface?.kind === kind) {
            return { surface, point: hit.point.toArray() as Vec3 };
          }
        }
        return null;
      },
      resetView() {
        camera.position.set(...framePosition);
        controls?.target.set(...building.camera.target);
        controls?.update();
      },
    }),
    [building, camera, controls, gl, surfaces, framePosition],
  );

  return (
    <>
      <group ref={targetsRef}>
        {building.surfaces.map((surface) => (
          <SurfaceTarget
            key={surface.id}
            surface={surface}
            colors={colors}
            highlighted={pendingKind === surface.kind}
          />
        ))}
      </group>

      {items.map((item) => {
        const surface = surfaces.get(item.surfaceId);
        const product = getProduct(item.slug);
        if (!surface || !product) return null;
        return (
          <PlacedItemModel
            key={item.id}
            item={item}
            surface={surface}
            items={items}
            colors={colors}
          />
        );
      })}

      {live && <EnergyFlow building={building} items={items} colors={colors} />}

      {ghost && surfaces.get(ghost.surfaceId) && getProduct(ghost.slug) && (
        <Mounted
          surface={surfaces.get(ghost.surfaceId)!}
          product={getProduct(ghost.slug)!}
          u={ghost.u}
          v={ghost.v}
          rotation={ghost.rotation}
        >
          <ProductModel product={getProduct(ghost.slug)!} colors={colors} ghost={{ valid: ghost.valid }} />
        </Mounted>
      )}
    </>
  );
}

/** Raycast target for a mount surface. Shows a green tint while a matching product is picked. */
function SurfaceTarget({
  surface,
  colors,
  highlighted,
}: {
  surface: MountSurface;
  colors: SceneColors;
  highlighted: boolean;
}) {
  const quaternion = useMemo(() => planeQuaternion(surface), [surface]);
  const geometry = useMemo(
    () =>
      surface.outline
        ? new ShapeGeometry(new Shape(surface.outline.map(([u, v]) => new Vector2(u, v))))
        : new PlaneGeometry(surface.width, surface.height),
    [surface],
  );
  const position = useMemo(() => {
    const [x, y, z] = surface.origin;
    const [nx, ny, nz] = surface.normal;
    return [x + nx * 0.01, y + ny * 0.01, z + nz * 0.01] as Vec3;
  }, [surface]);

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const state = useSimulator.getState();
    if (!state.pendingSlug) return;
    e.stopPropagation();
    state.setGhost(ghostAt(state.pendingSlug, surface, e.point.toArray() as Vec3, currentItems(state)));
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const { pendingSlug, ghost, addItem } = useSimulator.getState();
    if (!pendingSlug || e.delta > 6) return;
    e.stopPropagation();
    if (ghost?.valid && ghost.surfaceId === surface.id) {
      addItem({ slug: ghost.slug, surfaceId: ghost.surfaceId, u: ghost.u, v: ghost.v, rotation: ghost.rotation });
    }
  };

  return (
    <mesh
      position={position}
      quaternion={quaternion}
      geometry={geometry}
      userData={{ surfaceId: surface.id }}
      onPointerMove={onMove}
      onPointerOut={() => useSimulator.getState().pendingSlug && useSimulator.getState().setGhost(null)}
      onClick={onClick}
    >
      <meshBasicMaterial
        color={colors.green}
        transparent
        opacity={highlighted ? 0.18 : 0}
        depthWrite={false}
      />
    </mesh>
  );
}

type DragState = { u: number; v: number; valid: boolean; offU: number; offV: number; moved: boolean };

function PlacedItemModel({
  item,
  surface,
  items,
  colors,
}: {
  item: PlacedItem;
  surface: MountSurface;
  items: PlacedItem[];
  colors: SceneColors;
}) {
  // Read controls at event time instead of mutating a value captured from render.
  const getThree = useThree((s) => s.get);
  const setOrbit = (enabled: boolean) => {
    const controls = getThree().controls as OrbitControlsImpl | null;
    if (controls) controls.enabled = enabled;
  };
  const product = getProduct(item.slug)!;
  const selected = useSimulator((s) => s.selectedId === item.id);
  const [drag, setDrag] = useState<DragState | null>(null);
  const plane = useMemo(
    () => new Plane().setFromNormalAndCoplanarPoint(new Vector3(...surface.normal), new Vector3(...surface.origin)),
    [surface],
  );

  const localFromRay = (e: ThreeEvent<PointerEvent>) => {
    const hit = e.ray.intersectPlane(plane, new Vector3());
    return hit ? worldToSurface(surface, hit.toArray() as Vec3) : null;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const state = useSimulator.getState();
    state.select(item.id);
    if (state.pendingSlug) return;
    const local = localFromRay(e);
    if (!local) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setOrbit(false);
    setDrag({ u: item.u, v: item.v, valid: true, offU: local.u - item.u, offV: local.v - item.v, moved: false });
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag) return;
    e.stopPropagation();
    const local = localFromRay(e);
    if (!local) return;
    const next = resolvePlacement({
      surface,
      product,
      rotation: item.rotation,
      u: local.u - drag.offU,
      v: local.v - drag.offV,
      items,
      getProduct,
      ignoreId: item.id,
    });
    setDrag({ ...drag, ...next, moved: drag.moved || next.u !== item.u || next.v !== item.v });
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!drag) return;
    e.stopPropagation();
    (e.target as Element).releasePointerCapture(e.pointerId);
    setOrbit(true);
    if (drag.moved && drag.valid) useSimulator.getState().moveItem(item.id, drag.u, drag.v);
    setDrag(null);
  };

  const pos = drag ?? item;
  const invalid = drag && !drag.valid;

  return (
    <Mounted surface={surface} product={product} u={pos.u} v={pos.v} rotation={item.rotation}>
      <group
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={() => (document.body.style.cursor = "grab")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        {invalid ? (
          <ProductModel product={product} colors={colors} ghost={{ valid: false }} />
        ) : (
          <ProductModel product={product} colors={colors} selected={selected || Boolean(drag)} />
        )}
      </group>
    </Mounted>
  );
}


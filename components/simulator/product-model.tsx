"use client";

import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Product } from "@/lib/products";
import type { SceneColors } from "./theme";

let panelTexture: CanvasTexture | null = null;

/** Black cell grid, drawn once and shared by every panel. */
function getPanelTexture(colors: SceneColors) {
  if (panelTexture) return panelTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 200;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = colors.black;
  ctx.fillRect(0, 0, 120, 200);
  ctx.strokeStyle = colors.gray500;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  for (let x = 0; x <= 6; x++) {
    ctx.beginPath();
    ctx.moveTo(x * 20, 0);
    ctx.lineTo(x * 20, 200);
    ctx.stroke();
  }
  for (let y = 0; y <= 10; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * 20);
    ctx.lineTo(120, y * 20);
    ctx.stroke();
  }
  panelTexture = new CanvasTexture(canvas);
  panelTexture.colorSpace = SRGBColorSpace;
  return panelTexture;
}

type ModelProps = {
  product: Product;
  colors: SceneColors;
  selected?: boolean;
  /** Render as a translucent green/red preview instead of the real model. */
  ghost?: { valid: boolean };
};

/**
 * A product model in mount space: footprint w (X) × h (Z), depth along +Y, centred at the origin.
 * Models are built unrotated; the parent applies the 90° rotation.
 */
export function ProductModel({ product, colors, selected, ghost }: ModelProps) {
  const { w, h, d } = product.size;
  const texture = useMemo(
    () => (product.category === "panel" ? getPanelTexture(colors) : null),
    [product.category, colors],
  );

  if (ghost) {
    return (
      <mesh>
        <boxGeometry args={[w, Math.max(d, 0.05), h]} />
        <meshBasicMaterial
          color={ghost.valid ? colors.green : colors.danger}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
    );
  }

  const outline = selected ? <Edges color={colors.green} lineWidth={2} /> : null;

  if (product.category === "panel") {
    return (
      <group>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, d, h]} />
          <meshStandardMaterial color={colors.gray200} metalness={0.6} roughness={0.4} />
          {outline}
        </mesh>
        <mesh position={[0, d / 2 + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w - 0.04, h - 0.04]} />
          <meshStandardMaterial
            map={texture}
            metalness={0.3}
            roughness={0.25}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>
    );
  }

  // Inverter / battery: white wall-mounted cabinet with a green status strip.
  const strip =
    product.category === "battery"
      ? { size: [0.03, 0.01, h * 0.6] as const, z: 0 }
      : { size: [w * 0.5, 0.01, 0.03] as const, z: -h * 0.3 };

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, d, h]} />
        <meshStandardMaterial color={colors.white} roughness={0.5} />
        {outline}
      </mesh>
      <mesh position={[0, d / 2 + 0.005, strip.z]}>
        <boxGeometry args={[...strip.size]} />
        <meshBasicMaterial color={colors.green} />
      </mesh>
      {product.category === "inverter" && (
        <mesh position={[0, d / 2 + 0.005, h * 0.05]}>
          <boxGeometry args={[w * 0.35, 0.01, h * 0.18]} />
          <meshStandardMaterial color={colors.black} roughness={0.2} />
        </mesh>
      )}
    </group>
  );
}

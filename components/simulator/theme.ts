"use client";

import { useState } from "react";
import { Color, Matrix4, Quaternion, Vector3 } from "three";
import type { MountSurface } from "@/lib/simulator/buildings";

/** 3D colours read from the CSS design tokens in app/globals.css. */
export type SceneColors = {
  green: string;
  black: string;
  white: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray500: string;
  roof: string;
  danger: string;
};

function readColors(): SceneColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const black = v("--black");
  const gray500 = v("--gray-500");
  return {
    green: v("--green"),
    black,
    white: v("--white"),
    gray50: v("--gray-50"),
    gray100: v("--gray-100"),
    gray200: v("--gray-200"),
    gray500,
    roof: `#${new Color(gray500).lerp(new Color(black), 0.35).getHexString()}`,
    danger: v("--destructive"),
  };
}

export function useSceneColors() {
  const [colors] = useState(readColors);
  return colors;
}

/**
 * Orientation for something mounted on a surface: local X = uAxis, Y = normal (out of the surface),
 * Z = -vAxis. Models are built with their footprint in XZ and their depth along +Y.
 */
export function surfaceQuaternion(surface: MountSurface) {
  const m = new Matrix4().makeBasis(
    new Vector3(...surface.uAxis),
    new Vector3(...surface.normal),
    new Vector3(...surface.vAxis).negate(),
  );
  return new Quaternion().setFromRotationMatrix(m);
}

/** Orientation for a flat plane lying on the surface (PlaneGeometry faces +Z). */
export function planeQuaternion(surface: MountSurface) {
  const m = new Matrix4().makeBasis(
    new Vector3(...surface.uAxis),
    new Vector3(...surface.vAxis),
    new Vector3(...surface.normal),
  );
  return new Quaternion().setFromRotationMatrix(m);
}

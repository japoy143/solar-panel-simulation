import { add, cross, length, mid, normalize, scale, sub, type Vec3 } from "./vec";

/**
 * A rectangular area products can be mounted on.
 * Local coords (u, v) are metres from `origin`, along `uAxis` (width) and `vAxis` (height / up-slope).
 * `normal` = uAxis × vAxis points out of the building.
 */
export type MountSurface = {
  id: string;
  label: string;
  kind: "roof" | "wall";
  origin: Vec3;
  uAxis: Vec3;
  vAxis: Vec3;
  normal: Vec3;
  width: number;
  height: number;
  /** Flat roofs: panels are tilted on racks by this many degrees and need wider row spacing. */
  panelTilt?: number;
  rowGap?: number;
  /** Optional convex outline in local (u, v) for non-rectangular areas (e.g. hip-roof trapezoids). */
  outline?: [number, number][];
};

export type BuildingBox = {
  position: Vec3;
  size: Vec3;
  material: "wall" | "roof" | "glass" | "trim";
};

export type BuildingPolygon = { points: Vec3[]; material: "wall" | "roof" };

export type BuildingId =
  | "small-house"
  | "medium-house"
  | "large-house"
  | "modern-cabin"
  | "modern-bungalow"
  | "modern-split"
  | "modern-two-storey"
  | "modern-villa"
  | "commercial";

export type Building = {
  id: BuildingId;
  name: string;
  kind: "Residential" | "Commercial";
  dimensions: string;
  boxes: BuildingBox[];
  polygons: BuildingPolygon[];
  surfaces: MountSurface[];
  camera: { position: Vec3; target: Vec3 };
};

const MARGIN = 0.3; // keep panels this far from roof edges

function surface(
  id: string,
  label: string,
  kind: MountSurface["kind"],
  origin: Vec3,
  uAxis: Vec3,
  vAxis: Vec3,
  width: number,
  height: number,
  extra: Partial<MountSurface> = {},
): MountSurface {
  const u = normalize(uAxis);
  const v = normalize(vAxis);
  return { id, label, kind, origin, uAxis: u, vAxis: v, normal: cross(u, v), width, height, ...extra };
}

/** Gable roof with the ridge running along X. Returns 2 slopes + 2 gable-end triangles. */
function gableRoof(opts: {
  id: string;
  cx: number;
  cz: number;
  w: number;
  d: number;
  eaveY: number;
  rise: number;
  overhang?: number;
}) {
  const { id, cx, cz, w, d, eaveY, rise, overhang = 0.4 } = opts;
  const halfRun = d / 2;
  const slope = rise / halfRun;
  const ridgeY = eaveY + rise;
  const x0 = cx - w / 2 - overhang;
  const x1 = cx + w / 2 + overhang;
  const eaveDrop = slope * overhang;

  const faces = ([1, -1] as const).map((side) => {
    const zE = cz + side * (halfRun + overhang);
    const yE = eaveY - eaveDrop;
    const eaveA: Vec3 = [x0, yE, zE];
    const eaveB: Vec3 = [x1, yE, zE];
    const ridgeA: Vec3 = [x0, ridgeY, cz];
    const ridgeB: Vec3 = [x1, ridgeY, cz];
    // For the -Z face, flip u so the normal still points outward.
    const uAxis: Vec3 = side === 1 ? [1, 0, 0] : [-1, 0, 0];
    const vAxis = sub(ridgeA, eaveA);
    const slopeLen = length(vAxis);
    const center = mid(mid(eaveA, eaveB), mid(ridgeA, ridgeB));
    return {
      polygon: { points: [eaveA, eaveB, ridgeB, ridgeA], material: "roof" as const },
      surface: surface(
        `${id}-${side === 1 ? "south" : "north"}`,
        side === 1 ? "South roof" : "North roof",
        "roof",
        center,
        uAxis,
        vAxis,
        x1 - x0 - 2 * MARGIN,
        slopeLen - 2 * MARGIN,
      ),
    };
  });

  const gableEnds: BuildingPolygon[] = [cx - w / 2, cx + w / 2].map((x) => ({
    material: "wall",
    points: [
      [x, eaveY, cz - halfRun],
      [x, eaveY, cz + halfRun],
      [x, ridgeY, cz],
    ],
  }));

  return {
    polygons: [...faces.map((f) => f.polygon), ...gableEnds],
    surfaces: faces.map((f) => f.surface),
  };
}

/** Hip roof (X longer than Z). Two trapezoids carry mount surfaces; the end triangles don't. */
function hipRoof(opts: {
  id: string;
  cx: number;
  cz: number;
  w: number;
  d: number;
  eaveY: number;
  rise: number;
  overhang?: number;
}) {
  const { id, cx, cz, w, d, eaveY, rise, overhang = 0.4 } = opts;
  const ridgeY = eaveY + rise;
  const ridgeHalf = Math.max(0.5, w / 2 - d / 2);
  const ex = w / 2 + overhang;
  const ez = d / 2 + overhang;
  const yE = eaveY - (rise / (d / 2)) * overhang;
  const r0: Vec3 = [cx - ridgeHalf, ridgeY, cz];
  const r1: Vec3 = [cx + ridgeHalf, ridgeY, cz];
  const c = (sx: number, sz: number): Vec3 => [cx + sx * ex, yE, cz + sz * ez];

  const polygons: BuildingPolygon[] = [
    { material: "roof", points: [c(-1, 1), c(1, 1), r1, r0] },
    { material: "roof", points: [c(1, -1), c(-1, -1), r0, r1] },
    { material: "roof", points: [c(1, 1), c(1, -1), r1] },
    { material: "roof", points: [c(-1, -1), c(-1, 1), r0] },
  ];

  // Mount on the whole trapezoid: bounding rectangle + inset outline.
  const surfaces = ([1, -1] as const).map((side) => {
    const eaveMid: Vec3 = [cx, yE, cz + side * ez];
    const ridgeMid: Vec3 = [cx, ridgeY, cz];
    const vAxis = sub(ridgeMid, eaveMid);
    const slopeLen = length(vAxis);
    const bottom = 2 * ex;
    const top = 2 * ridgeHalf;
    const width = bottom - 2 * MARGIN;
    const height = slopeLen - 2 * MARGIN;
    const origin = add(eaveMid, scale(normalize(vAxis), slopeLen / 2));
    const side_ = MARGIN * 1.6; // extra inset along the sloped hip edges
    const outline: [number, number][] = [
      [-bottom / 2 + side_, -height / 2],
      [bottom / 2 - side_, -height / 2],
      [top / 2 - side_, height / 2],
      [-top / 2 + side_, height / 2],
    ];
    return surface(
      `${id}-${side === 1 ? "south" : "north"}`,
      side === 1 ? "South roof" : "North roof",
      "roof",
      origin,
      side === 1 ? [1, 0, 0] : [-1, 0, 0],
      vAxis,
      width,
      height,
      { outline },
    );
  });

  return { polygons, surfaces };
}

/**
 * Mono-pitch (skillion) roof: low eave on the south (+Z) side rising to the north.
 * The box below should be `lowY` tall; this adds the side-wall wedges and the raised north wall.
 * `overhangW` / `overhangE` let a roof butt up against a neighbouring volume without clipping it.
 */
function shedRoof(opts: {
  id: string;
  label: string;
  cx: number;
  cz: number;
  w: number;
  d: number;
  lowY: number;
  rise: number;
  overhang?: number;
  overhangW?: number;
  overhangE?: number;
}) {
  const { id, label, cx, cz, w, d, lowY, rise, overhang = 0.4 } = opts;
  const { overhangW = overhang, overhangE = overhang } = opts;
  const highY = lowY + rise;
  const slope = rise / d;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const zS = cz + d / 2;
  const zN = cz - d / 2;
  const eaveS: Vec3 = [0, lowY - slope * overhang, zS + overhang];
  const eaveN: Vec3 = [0, highY + slope * overhang, zN - overhang];
  const at = (x: number, p: Vec3): Vec3 => [x, p[1], p[2]];
  const rx0 = x0 - overhangW;
  const rx1 = x1 + overhangE;

  const polygons: BuildingPolygon[] = [
    { material: "roof", points: [at(rx0, eaveS), at(rx1, eaveS), at(rx1, eaveN), at(rx0, eaveN)] },
    // North wall above the box, and the two wedge-shaped side walls.
    { material: "wall", points: [[x0, lowY, zN], [x1, lowY, zN], [x1, highY, zN], [x0, highY, zN]] },
    ...[x0, x1].map((x) => ({
      material: "wall" as const,
      points: [[x, lowY, zS], [x, lowY, zN], [x, highY, zN]] as Vec3[],
    })),
  ];

  const vAxis = sub(eaveN, eaveS);
  const center: Vec3 = [(rx0 + rx1) / 2, (eaveS[1] + eaveN[1]) / 2, (eaveS[2] + eaveN[2]) / 2];
  return {
    polygons,
    surfaces: [
      surface(id, label, "roof", center, [1, 0, 0], vAxis, rx1 - rx0 - 2 * MARGIN, length(vAxis) - 2 * MARGIN),
    ],
  };
}

/** Flat roof with a parapet. Panels go on tilted racks (like the commercial roof). */
function flatRoof(opts: {
  id: string;
  label: string;
  cx: number;
  cz: number;
  w: number;
  d: number;
  y: number;
  parapet?: number;
}) {
  const { id, label, cx, cz, w, d, y, parapet = 0.5 } = opts;
  const t = 0.25;
  const inset = t + 0.45; // keep racks clear of the parapet and its shadow
  const py = y + parapet / 2;
  const boxes: BuildingBox[] = [
    { position: [cx, y + 0.02, cz], size: [w - 0.1, 0.04, d - 0.1], material: "roof" },
    { position: [cx, py, cz + d / 2 - t / 2], size: [w, parapet, t], material: "wall" },
    { position: [cx, py, cz - d / 2 + t / 2], size: [w, parapet, t], material: "wall" },
    { position: [cx + w / 2 - t / 2, py, cz], size: [t, parapet, d - 2 * t], material: "wall" },
    { position: [cx - w / 2 + t / 2, py, cz], size: [t, parapet, d - 2 * t], material: "wall" },
  ];
  return {
    boxes,
    surfaces: [
      surface(id, label, "roof", [cx, y + 0.04, cz], [1, 0, 0], [0, 0, -1], w - 2 * inset, d - 2 * inset, {
        panelTilt: 10,
        rowGap: 0.8,
      }),
    ],
  };
}

/** Equipment wall on the +X side of a box. */
function sideWall(id: string, label: string, x: number, cz: number, width: number): MountSurface {
  return surface(id, label, "wall", [x + 0.01, 1.4, cz], [0, 0, -1], [0, 1, 0], width, 2.2);
}

/** Windows/doors on the +Z facade, as thin dark boxes. */
function facade(cx: number, z: number, xs: number[], y: number, w = 1.2, h = 1.2): BuildingBox[] {
  return xs.map((x) => ({
    position: [cx + x, y, z + 0.02],
    size: [w, h, 0.05],
    material: "glass" as const,
  }));
}

const smallHouse: Building = (() => {
  const roof = gableRoof({ id: "sh", cx: 0, cz: 0, w: 7.5, d: 6, eaveY: 3, rise: 2.2 });
  return {
    id: "small-house",
    name: "Small house",
    kind: "Residential",
    dimensions: "7.5 × 6 m · gable roof",
    boxes: [
      { position: [0, 1.5, 0], size: [7.5, 3, 6], material: "wall" },
      ...facade(0, 3, [-2.2, 2.2], 1.6),
      { position: [0, 1.05, 3.02], size: [1, 2.1, 0.05], material: "trim" },
    ],
    polygons: roof.polygons,
    surfaces: [...roof.surfaces, sideWall("sh-wall", "East wall", 3.75, 0, 4.8)],
    camera: { position: [11, 9, 14], target: [0, 2, 0] },
  };
})();

const mediumHouse: Building = (() => {
  const roof = hipRoof({ id: "mh", cx: 0, cz: 0, w: 14, d: 9, eaveY: 5.6, rise: 2.6 });
  return {
    id: "medium-house",
    name: "Medium house",
    kind: "Residential",
    dimensions: "14 × 9 m · hip roof",
    boxes: [
      { position: [0, 2.8, 0], size: [14, 5.6, 9], material: "wall" },
      ...facade(0, 4.5, [-4.5, -1.5, 1.5, 4.5], 4, 1.3, 1.3),
      ...facade(0, 4.5, [-4.5, 1.5, 4.5], 1.5, 1.3, 1.3),
      { position: [-1.5, 1.05, 4.52], size: [1.1, 2.1, 0.05], material: "trim" },
    ],
    polygons: roof.polygons,
    surfaces: [...roof.surfaces, sideWall("mh-wall", "East wall", 7, 0, 7.4)],
    camera: { position: [19, 15, 23], target: [0, 3.5, 0] },
  };
})();

const largeHouse: Building = (() => {
  const main = gableRoof({ id: "lh-main", cx: -2, cz: 0, w: 14, d: 10, eaveY: 6, rise: 3 });
  const garage = gableRoof({ id: "lh-garage", cx: 8, cz: 0.5, w: 6, d: 7, eaveY: 3, rise: 1.6 });
  // Label the garage faces so they're distinguishable in the UI.
  garage.surfaces.forEach((s) => (s.label = s.label.replace("roof", "garage roof")));
  return {
    id: "large-house",
    name: "Large house",
    kind: "Residential",
    dimensions: "20 × 10 m · gable roof + garage",
    boxes: [
      { position: [-2, 3, 0], size: [14, 6, 10], material: "wall" },
      { position: [8, 1.5, 0.5], size: [6, 3, 7], material: "wall" },
      ...facade(-2, 5, [-5, -2, 1, 4], 4.3, 1.4, 1.4),
      ...facade(-2, 5, [-5, 1, 4], 1.6, 1.4, 1.4),
      { position: [-2, 1.1, 5.02], size: [1.2, 2.2, 0.05], material: "trim" },
      { position: [8, 1.15, 4.02], size: [4.2, 2.3, 0.05], material: "trim" },
    ],
    polygons: [...main.polygons, ...garage.polygons],
    surfaces: [...main.surfaces, ...garage.surfaces, sideWall("lh-wall", "Garage east wall", 11, 0.5, 5.6)],
    camera: { position: [25, 19, 30], target: [1, 3, 0] },
  };
})();

// --- Modern houses, smallest to largest ---------------------------------------------------

const modernCabin: Building = (() => {
  const roof = shedRoof({ id: "mc-roof", label: "Roof", cx: 0, cz: 0, w: 6, d: 5, lowY: 2.8, rise: 1.2 });
  return {
    id: "modern-cabin",
    name: "Modern cabin",
    kind: "Residential",
    dimensions: "6 × 5 m · mono-pitch roof",
    boxes: [
      { position: [0, 1.4, 0], size: [6, 2.8, 5], material: "wall" },
      ...facade(0, 2.5, [-1.2], 1.3, 2.6, 1.9),
      { position: [1.8, 1.05, 2.52], size: [1, 2.1, 0.05], material: "trim" },
    ],
    polygons: roof.polygons,
    surfaces: [...roof.surfaces, sideWall("mc-wall", "East wall", 3, 0, 3.6)],
    camera: { position: [10, 8, 12], target: [0, 1.8, 0] },
  };
})();

const modernBungalow: Building = (() => {
  const roof = flatRoof({ id: "mb-roof", label: "Flat roof", cx: 0, cz: 0, w: 10, d: 8, y: 3.2 });
  return {
    id: "modern-bungalow",
    name: "Modern bungalow",
    kind: "Residential",
    dimensions: "10 × 8 m · flat roof",
    boxes: [
      { position: [0, 1.6, 0], size: [10, 3.2, 8], material: "wall" },
      ...roof.boxes,
      ...facade(0, 4, [-2.5], 1.3, 3.6, 2.2),
      ...facade(0, 4, [3.3], 1.8, 1.4, 1.2),
      { position: [1, 1.1, 4.02], size: [1, 2.2, 0.05], material: "trim" },
    ],
    polygons: [],
    surfaces: [...roof.surfaces, sideWall("mb-wall", "East wall", 5, 0, 6)],
    camera: { position: [15, 12, 18], target: [0, 2, 0] },
  };
})();

const modernSplit: Building = (() => {
  const lower = shedRoof({
    id: "ms-lower", label: "Lower roof", cx: -3, cz: 0, w: 7, d: 9, lowY: 3, rise: 1.5, overhangE: 0,
  });
  const upper = shedRoof({
    id: "ms-upper", label: "Upper roof", cx: 3.5, cz: -0.75, w: 6, d: 7.5, lowY: 4.2, rise: 1.3,
  });
  return {
    id: "modern-split",
    name: "Modern split-level",
    kind: "Residential",
    dimensions: "13 × 9 m · split skillion roofs",
    boxes: [
      { position: [-3, 1.5, 0], size: [7, 3, 9], material: "wall" },
      { position: [3.5, 2.1, -0.75], size: [6, 4.2, 7.5], material: "wall" },
      ...facade(0, 4.5, [-4.5], 1.2, 2.6, 2),
      { position: [-1.6, 1.1, 4.52], size: [1, 2.2, 0.05], material: "trim" },
      ...facade(3.5, 3, [0], 1.6, 4, 2.6),
    ],
    polygons: [...lower.polygons, ...upper.polygons],
    surfaces: [...lower.surfaces, ...upper.surfaces, sideWall("ms-wall", "East wall", 6.5, -0.75, 5.5)],
    camera: { position: [18, 14, 22], target: [0, 2.5, 0] },
  };
})();

const modernTwoStorey: Building = (() => {
  const top = flatRoof({ id: "mt-upper", label: "Upper roof", cx: -3, cz: 0, w: 10, d: 10, y: 6.4 });
  const terrace = flatRoof({ id: "mt-terrace", label: "Terrace roof", cx: 5, cz: 0, w: 6, d: 10, y: 3.2, parapet: 0.4 });
  return {
    id: "modern-two-storey",
    name: "Modern two-storey",
    kind: "Residential",
    dimensions: "16 × 10 m · 2 storeys, flat roofs",
    boxes: [
      { position: [0, 1.6, 0], size: [16, 3.2, 10], material: "wall" },
      { position: [-3, 4.8, 0], size: [10, 3.2, 10], material: "wall" },
      ...top.boxes,
      ...terrace.boxes,
      ...facade(0, 5, [-5], 1.3, 4, 2.2),
      ...facade(0, 5, [4.5], 1.3, 5, 2.2),
      { position: [-1.5, 1.1, 5.02], size: [1.1, 2.2, 0.05], material: "trim" },
      ...facade(-3, 5, [0], 4.9, 7, 1.8),
    ],
    polygons: [],
    surfaces: [...top.surfaces, ...terrace.surfaces, sideWall("mt-wall", "East wall", 8, 0, 8)],
    camera: { position: [22, 17, 27], target: [0, 3.5, 0] },
  };
})();

const modernVilla: Building = (() => {
  const main = flatRoof({ id: "mv-main", label: "Main roof", cx: -2, cz: 0, w: 20, d: 11, y: 6.6, parapet: 0.6 });
  const living = flatRoof({ id: "mv-living", label: "Living room roof", cx: -7, cz: 7.5, w: 8, d: 4, y: 3.4, parapet: 0.4 });
  const garage = shedRoof({
    id: "mv-garage", label: "Garage roof", cx: 11.5, cz: 0.5, w: 7, d: 8, lowY: 3.2, rise: 0.9, overhangW: 0,
  });
  return {
    id: "modern-villa",
    name: "Modern villa",
    kind: "Residential",
    dimensions: "27 × 15 m · flat roofs + garage",
    boxes: [
      { position: [-2, 3.3, 0], size: [20, 6.6, 11], material: "wall" },
      { position: [-7, 1.7, 7.5], size: [8, 3.4, 4], material: "wall" },
      { position: [11.5, 1.6, 0.5], size: [7, 3.2, 8], material: "wall" },
      ...main.boxes,
      ...living.boxes,
      ...facade(-2, 5.5, [0], 5, 16, 1.8),
      ...facade(0, 5.5, [2.5], 1.4, 6, 2.4),
      { position: [-1.5, 1.2, 5.52], size: [1.2, 2.4, 0.05], material: "trim" },
      ...facade(-7, 9.5, [0], 1.5, 6.5, 2.4),
      { position: [11.5, 1.2, 4.52], size: [4.6, 2.4, 0.05], material: "trim" },
    ],
    polygons: garage.polygons,
    surfaces: [
      ...main.surfaces,
      ...living.surfaces,
      ...garage.surfaces,
      sideWall("mv-wall", "Garage east wall", 15, 0.5, 6),
    ],
    camera: { position: [32, 24, 38], target: [1, 3, 1] },
  };
})();

const commercial: Building = (() => {
  const W = 30;
  const D = 20;
  const H = 8;
  const P = 0.9; // parapet height
  const t = 0.3;
  return {
    id: "commercial",
    name: "Commercial building",
    kind: "Commercial",
    dimensions: "30 × 20 m · flat roof",
    boxes: [
      { position: [0, H / 2, 0], size: [W, H, D], material: "wall" },
      { position: [0, H + 0.02, 0], size: [W - 0.1, 0.04, D - 0.1], material: "roof" },
      // parapet
      { position: [0, H + P / 2, D / 2 - t / 2], size: [W, P, t], material: "wall" },
      { position: [0, H + P / 2, -D / 2 + t / 2], size: [W, P, t], material: "wall" },
      { position: [W / 2 - t / 2, H + P / 2, 0], size: [t, P, D], material: "wall" },
      { position: [-W / 2 + t / 2, H + P / 2, 0], size: [t, P, D], material: "wall" },
      // window bands + entrance
      { position: [0, 5.6, D / 2 + 0.02], size: [W - 4, 1.6, 0.05], material: "glass" },
      { position: [0, 2.6, D / 2 + 0.02], size: [W - 10, 1.6, 0.05], material: "glass" },
      { position: [-11, 1.2, D / 2 + 0.02], size: [3, 2.4, 0.05], material: "trim" },
    ],
    polygons: [],
    surfaces: [
      surface("cb-roof", "Flat roof", "roof", [0, H + 0.04, 0], [1, 0, 0], [0, 0, -1], W - 2.4, D - 2.4, {
        panelTilt: 10,
        rowGap: 0.8,
      }),
      sideWall("cb-wall", "East wall", W / 2, 0, 10),
    ],
    camera: { position: [44, 34, 50], target: [0, 4, 0] },
  };
})();

export const buildings: Building[] = [
  smallHouse,
  mediumHouse,
  largeHouse,
  modernCabin,
  modernBungalow,
  modernSplit,
  modernTwoStorey,
  modernVilla,
  commercial,
];

export function getBuilding(id: string): Building {
  return buildings.find((b) => b.id === id) ?? smallHouse;
}

export function isBuildingId(id: string | null): id is BuildingId {
  return buildings.some((b) => b.id === id);
}

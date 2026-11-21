import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildings, getBuilding, isBuildingId, type MountSurface } from "@/lib/simulator/buildings";
import {
  autoFill,
  clamp,
  collides,
  fitsSurface,
  footprint,
  insideOutline,
  resolvePlacement,
  snap,
  surfaceToWorld,
  worldToSurface,
  type PlacedItem,
} from "@/lib/simulator/geometry";
import { inverter, lookup, panel } from "./fixtures";

const roof: MountSurface = {
  id: "r",
  label: "Roof",
  kind: "roof",
  origin: [0, 5, 0],
  uAxis: [1, 0, 0],
  vAxis: [0, 0, -1],
  normal: [0, 1, 0],
  width: 6,
  height: 4,
};

let n = 0;
const makeId = () => `id${n++}`;

describe("footprint", () => {
  test("rotation swaps width and height", () => {
    assert.deepEqual(footprint(panel, 0), { w: 1.13, h: 1.72 });
    assert.deepEqual(footprint(panel, 90), { w: 1.72, h: 1.13 });
  });
});

describe("surface coordinates", () => {
  test("worldToSurface inverts surfaceToWorld", () => {
    for (const b of buildings) {
      for (const s of b.surfaces) {
        const p = surfaceToWorld(s, 1.25, -0.5);
        const { u, v } = worldToSurface(s, p);
        assert.ok(Math.abs(u - 1.25) < 1e-9 && Math.abs(v + 0.5) < 1e-9, `${b.id}/${s.id}`);
      }
    }
  });

  test("surface axes are unit length and normal is perpendicular", () => {
    for (const b of buildings) {
      for (const s of b.surfaces) {
        const len = (a: number[]) => Math.hypot(...a);
        assert.ok(Math.abs(len(s.uAxis) - 1) < 1e-9);
        assert.ok(Math.abs(len(s.vAxis) - 1) < 1e-9);
        const dot = s.normal[0] * s.uAxis[0] + s.normal[1] * s.uAxis[1] + s.normal[2] * s.uAxis[2];
        assert.ok(Math.abs(dot) < 1e-9);
        assert.ok(s.width > 0 && s.height > 0, `${s.id} has a positive size`);
      }
    }
  });

  test("roof normals point up/outward (positive Y)", () => {
    for (const b of buildings) for (const s of b.surfaces.filter((x) => x.kind === "roof")) assert.ok(s.normal[1] > 0, s.id);
  });
});

describe("snap", () => {
  test("panels snap to a grid anchored at the lower-left corner", () => {
    const { u, v } = snap(roof, panel, 0, -2.4, -1.0);
    assert.ok(Math.abs(u - (-3 + 1.13 / 2)) < 1e-9);
    assert.ok(Math.abs(v - (-2 + 1.72 / 2)) < 1e-9);
  });

  test("wall equipment snaps to a 5 cm grid", () => {
    const { u, v } = snap({ ...roof, kind: "wall" }, inverter, 0, 0.123, -0.876);
    assert.ok(Math.abs(u - 0.1) < 1e-9);
    assert.ok(Math.abs(v + 0.9) < 1e-9);
  });
});

describe("clamp / fitsSurface", () => {
  test("clamp keeps the footprint on the surface", () => {
    const { u, v } = clamp(roof, panel, 0, 100, -100);
    assert.ok(Math.abs(u - (3 - 1.13 / 2)) < 1e-9);
    assert.ok(Math.abs(v - -(2 - 1.72 / 2)) < 1e-9);
  });

  test("clamp centres an item larger than the surface", () => {
    assert.deepEqual(clamp({ ...roof, width: 1, height: 1 }, panel, 0, 5, 5), { u: 0, v: 0 });
  });

  test("fitsSurface checks placement kind and size", () => {
    assert.equal(fitsSurface(roof, panel, 0), true);
    assert.equal(fitsSurface(roof, inverter, 0), false);
    assert.equal(fitsSurface({ ...roof, height: 1.5 }, panel, 0), false);
    assert.equal(fitsSurface({ ...roof, height: 1.5 }, panel, 90), true);
  });
});

describe("insideOutline", () => {
  const outline: [number, number][] = [
    [-2, -1],
    [2, -1],
    [1, 1],
    [-1, 1],
  ];
  const trap = { ...roof, outline };
  test("no outline means always inside", () => assert.equal(insideOutline(roof, { u: 99, v: 99, w: 1, h: 1 }), true));
  test("rect in the middle is inside", () => assert.equal(insideOutline(trap, { u: 0, v: 0, w: 1, h: 1 }), true));
  test("rect crossing a sloped edge is outside", () =>
    assert.equal(insideOutline(trap, { u: 1.4, v: 0.5, w: 0.5, h: 0.5 }), false));
});

describe("collides / resolvePlacement", () => {
  const items: PlacedItem[] = [{ id: "a", slug: panel.slug, surfaceId: "r", u: 0, v: 0, rotation: 0 }];

  test("overlap on the same surface collides", () => {
    assert.equal(collides({ u: 0.5, v: 0, w: 1.13, h: 1.72 }, "r", items, lookup), true);
  });
  test("touching neighbours (shared edge) don't collide", () => {
    assert.equal(collides({ u: 1.13, v: 0, w: 1.13, h: 1.72 }, "r", items, lookup), false);
  });
  test("other surfaces and ignored ids don't collide", () => {
    assert.equal(collides({ u: 0, v: 0, w: 1, h: 1 }, "other", items, lookup), false);
    assert.equal(collides({ u: 0, v: 0, w: 1, h: 1 }, "r", items, lookup, "a"), false);
  });
  test("items whose product left the catalog are ignored", () => {
    const ghost = [{ ...items[0], slug: "gone" }];
    assert.equal(collides({ u: 0, v: 0, w: 1, h: 1 }, "r", ghost, lookup), false);
  });

  test("resolvePlacement: valid on an empty roof, invalid on top of another panel", () => {
    const ok = resolvePlacement({ surface: roof, product: panel, rotation: 0, u: 0, v: 0, items: [], getProduct: lookup });
    assert.equal(ok.valid, true);
    const placed: PlacedItem[] = [{ id: "a", slug: panel.slug, surfaceId: "r", u: ok.u, v: ok.v, rotation: 0 }];
    const again = resolvePlacement({ surface: roof, product: panel, rotation: 0, u: ok.u, v: ok.v, items: placed, getProduct: lookup });
    assert.equal(again.valid, false);
  });

  test("resolvePlacement rejects products for the wrong surface kind", () => {
    const r = resolvePlacement({ surface: roof, product: inverter, rotation: 0, u: 0, v: 0, items: [], getProduct: lookup });
    assert.equal(r.valid, false);
  });
});

describe("autoFill", () => {
  test("fills a plain roof with non-overlapping panels inside the surface", () => {
    const added = autoFill({ surface: roof, product: panel, rotation: 0, items: [], getProduct: lookup, makeId });
    // 6 m / (1.13 + 0.02) = 5 columns; 4 m / (1.72 + 0.02) = 2 rows.
    assert.equal(added.length, 10);
    for (const it of added) {
      assert.ok(Math.abs(it.u) + 1.13 / 2 <= roof.width / 2 + 1e-9);
      assert.ok(Math.abs(it.v) + 1.72 / 2 <= roof.height / 2 + 1e-9);
      assert.equal(collides({ u: it.u, v: it.v, w: 1.13, h: 1.72 }, "r", added, lookup, it.id), false);
    }
  });

  test("a second fill adds nothing", () => {
    const first = autoFill({ surface: roof, product: panel, rotation: 0, items: [], getProduct: lookup, makeId });
    const second = autoFill({ surface: roof, product: panel, rotation: 0, items: first, getProduct: lookup, makeId });
    assert.equal(second.length, 0);
  });

  test("every building's roofs fill without overlaps and within outlines", () => {
    for (const b of buildings) {
      let items: PlacedItem[] = [];
      for (const s of b.surfaces.filter((x) => x.kind === "roof")) {
        for (const rotation of [0, 90] as const) {
          const added = autoFill({ surface: s, product: panel, rotation, items, getProduct: lookup, makeId });
          for (const it of added) {
            const fp = footprint(panel, rotation);
            assert.ok(insideOutline(s, { u: it.u, v: it.v, ...fp }), `${s.id} outline`);
            assert.ok(Math.abs(it.u) + fp.w / 2 <= s.width / 2 + 1e-9, `${s.id} width`);
            assert.ok(Math.abs(it.v) + fp.h / 2 <= s.height / 2 + 1e-9, `${s.id} height`);
          }
          items = [...items, ...added];
        }
      }
      assert.ok(items.length > 0, `${b.id} fits at least one panel`);
    }
  });

  test("wall surfaces and non-fitting products add nothing", () => {
    const wall = getBuilding("small-house").surfaces.find((s) => s.kind === "wall")!;
    assert.deepEqual(autoFill({ surface: wall, product: panel, rotation: 0, items: [], getProduct: lookup, makeId }), []);
  });
});

describe("buildings", () => {
  test("ids are unique and lookups work", () => {
    assert.equal(new Set(buildings.map((b) => b.id)).size, buildings.length);
    const surfaceIds = buildings.flatMap((b) => b.surfaces.map((s) => s.id));
    assert.equal(new Set(surfaceIds).size, surfaceIds.length, "surface ids are globally unique");
    assert.equal(isBuildingId("commercial"), true);
    assert.equal(isBuildingId("castle"), false);
    assert.equal(isBuildingId(null), false);
    assert.equal(getBuilding("castle").id, "small-house");
  });

  test("every building has a roof and a wall surface", () => {
    for (const b of buildings) {
      assert.ok(b.surfaces.some((s) => s.kind === "roof"), `${b.id} roof`);
      assert.ok(b.surfaces.some((s) => s.kind === "wall"), `${b.id} wall`);
    }
  });
});

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { getCatalog, getProduct, setCatalog } from "@/lib/catalog";
import type { PlacedItem } from "@/lib/simulator/geometry";
import { missingParts, summarize, YIELD_KWH_PER_KWP } from "@/lib/simulator/summary";
import { all, battery, batteryNoRating, hybrid, inverter, panel } from "./fixtures";

let n = 0;
const item = (slug: string): PlacedItem => ({ id: `i${n++}`, slug, surfaceId: "s", u: 0, v: 0, rotation: 0 });
const many = (slug: string, count: number) => Array.from({ length: count }, () => item(slug));

describe("catalog", () => {
  test("setCatalog replaces the registry", () => {
    setCatalog([panel]);
    assert.equal(getProduct(panel.slug), panel);
    assert.equal(getProduct(inverter.slug), undefined);
    setCatalog([]);
    assert.deepEqual(getCatalog(), []);
    assert.equal(getProduct(panel.slug), undefined);
  });
});

describe("summarize", () => {
  beforeEach(() => setCatalog(all));

  test("empty layout", () => {
    const s = summarize([]);
    assert.equal(s.panels, 0);
    assert.equal(s.kwp, 0);
    assert.equal(s.yearlyKwh, 0);
    assert.equal(s.live, false);
    assert.equal(s.backupLimitKw, null);
    assert.deepEqual(s.warnings, []);
  });

  test("empty catalog: unknown slugs are ignored", () => {
    setCatalog([]);
    const s = summarize(many(panel.slug, 3));
    assert.equal(s.panels, 0);
    assert.deepEqual(s.products, []);
  });

  test("panels without an inverter warn and aren't live", () => {
    const s = summarize(many(panel.slug, 10));
    assert.equal(s.panels, 10);
    assert.ok(Math.abs(s.kwp - 4.1) < 1e-9);
    assert.equal(s.yearlyKwh, Math.round(4.1 * YIELD_KWH_PER_KWP));
    assert.equal(s.live, false);
    assert.match(s.warnings.join(" "), /Add an inverter/);
  });

  test("panels + inverter is live", () => {
    const s = summarize([...many(panel.slug, 10), item(inverter.slug)]);
    assert.equal(s.live, true);
    assert.equal(s.inverterKw, 5);
    assert.deepEqual(s.warnings, []);
    assert.deepEqual(
      s.products.map((p) => [p.slug, p.count]),
      [
        [panel.slug, 10],
        [inverter.slug, 1],
      ],
    );
  });

  test("oversized array warns", () => {
    const s = summarize([...many(panel.slug, 20), item(inverter.slug)]); // 8.2 kWp on 5 kW
    assert.match(s.warnings.join(" "), /large for 5 kW/);
  });

  test("battery on a non-hybrid inverter warns and isn't live", () => {
    const s = summarize([...many(panel.slug, 5), item(inverter.slug), item(battery.slug)]);
    assert.equal(s.live, false);
    assert.match(s.warnings.join(" "), /hybrid inverter/);
    // No hybrid inverter: only the battery's own output limits backup.
    assert.equal(s.backupLimitKw, 5);
  });

  test("backup limit is the smaller of battery output and hybrid inverter output", () => {
    const s = summarize([...many(panel.slug, 5), item(hybrid.slug), item(battery.slug), item(battery.slug)]);
    assert.equal(s.live, true);
    assert.equal(s.batteryKwh, 20);
    assert.equal(s.batteryOutputKw, 10);
    assert.equal(s.backupLimitKw, 6);
  });

  test("a battery without an output rating makes the battery output unknown", () => {
    const s = summarize([item(hybrid.slug), item(battery.slug), item(batteryNoRating.slug)]);
    assert.equal(s.batteryOutputKw, null);
    assert.equal(s.backupLimitKw, 6);
  });

  test("no battery: no battery output or backup limit", () => {
    const s = summarize([item(hybrid.slug)]);
    assert.equal(s.batteryOutputKw, null);
    assert.equal(s.backupLimitKw, 6);
  });
});

describe("missingParts (when savings / backup estimates appear)", () => {
  beforeEach(() => setCatalog(all));
  const parts = (slugs: string[], battery = false) => missingParts(summarize(slugs.map(item)), { battery });

  test("empty layout lists every step in build order", () => {
    assert.deepEqual(parts([]), ["Add solar panels to the roof", "Add an inverter"]);
    assert.deepEqual(parts([], true), ["Add solar panels to the roof", "Add a hybrid inverter", "Add a battery"]);
  });

  test("panels alone still need an inverter", () => {
    assert.deepEqual(parts([panel.slug]), ["Add an inverter"]);
  });

  test("an inverter alone still needs panels", () => {
    assert.deepEqual(parts([inverter.slug]), ["Add solar panels to the roof"]);
  });

  test("savings: panels + inverter is assembled", () => {
    assert.deepEqual(parts([panel.slug, inverter.slug]), []);
  });

  test("savings: a battery on a non-hybrid inverter isn't assembled", () => {
    assert.deepEqual(parts([panel.slug, inverter.slug, battery.slug]), ["Swap in a hybrid inverter for the battery"]);
  });

  test("backup: needs a hybrid inverter and a battery", () => {
    assert.deepEqual(parts([panel.slug, inverter.slug], true), ["Swap in a hybrid inverter for the battery", "Add a battery"]);
    assert.deepEqual(parts([panel.slug, hybrid.slug], true), ["Add a battery"]);
    assert.deepEqual(parts([panel.slug, hybrid.slug, battery.slug], true), []);
  });

  test("assembled for savings exactly when the layout is live", () => {
    const layouts = [[], [panel.slug], [panel.slug, inverter.slug], [panel.slug, inverter.slug, battery.slug], [panel.slug, hybrid.slug, battery.slug]];
    for (const slugs of layouts) {
      const s = summarize(slugs.map(item));
      assert.equal(missingParts(s).length === 0, s.live, slugs.join("+"));
    }
  });
});

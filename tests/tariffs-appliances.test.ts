import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  APPLIANCES,
  DEFAULT_SCENARIO,
  appliancesById,
  formatAlone,
  formatDuration,
  rechargeHours,
  runtimeAlone,
  runtimeTogether,
  usableKwh,
  USABLE_FACTOR,
} from "@/lib/simulator/appliances";
import { currencyCodes, detectCountry, FALLBACK_COUNTRY, getTariff, TARIFF_SOURCES, TARIFFS } from "@/lib/simulator/tariffs";

describe("tariffs", () => {
  test("codes are unique, prices positive, sources known, currencies valid", () => {
    assert.equal(new Set(TARIFFS.map((t) => t.code)).size, TARIFFS.length);
    const currencies = new Set(Intl.supportedValuesOf("currency"));
    for (const t of TARIFFS) {
      assert.match(t.code, /^[A-Z]{2}$/);
      assert.ok(t.price > 0 && Number.isFinite(t.price), t.code);
      assert.ok(TARIFF_SOURCES[t.source], `${t.code} source`);
      assert.ok(currencies.has(t.currency), `${t.code} currency ${t.currency}`);
    }
  });

  test("sorted by name", () => {
    const names = TARIFFS.map((t) => t.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  });

  test("getTariff is case-insensitive and tolerates empty input", () => {
    assert.equal(getTariff("ph")?.currency, "PHP");
    assert.equal(getTariff("PH")?.currency, "PHP");
    assert.equal(getTariff(""), undefined);
    assert.equal(getTariff(null), undefined);
    assert.equal(getTariff("ZZ"), undefined);
    assert.ok(getTariff(FALLBACK_COUNTRY), "fallback country has a preset");
  });

  test("detectCountry uses navigator.languages, skipping bad tags", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const set = (languages: string[]) =>
      Object.defineProperty(globalThis, "navigator", { value: { languages, language: languages[0] }, configurable: true });
    try {
      set(["not a tag!!", "en-PH"]);
      assert.equal(detectCountry(), "PH");
      set(["de"]); // maximizes to de-Latn-DE
      assert.equal(detectCountry(), "DE");
      set(["xx-ZZ"]);
      assert.equal(detectCountry(), FALLBACK_COUNTRY);
    } finally {
      if (original) Object.defineProperty(globalThis, "navigator", original);
    }
  });

  test("currencyCodes includes every preset currency", () => {
    const codes = new Set(currencyCodes());
    for (const t of TARIFFS) assert.ok(codes.has(t.currency));
  });
});

describe("appliances", () => {
  test("ids unique, defaults reference real appliances, ratings sane", () => {
    assert.equal(appliancesById.size, APPLIANCES.length);
    for (const id of Object.keys(DEFAULT_SCENARIO)) assert.ok(appliancesById.has(id), id);
    for (const a of APPLIANCES) {
      assert.ok(a.avgW > 0 && a.peakW >= a.avgW, a.id);
      if (a.unit !== "hours" && a.unit !== "minutes") assert.ok(a.whPerUse && a.whPerUse > 0, `${a.id} whPerUse`);
    }
  });

  test("usable capacity and runtimes", () => {
    assert.equal(usableKwh(10), 10 * USABLE_FACTOR);
    const fridge = appliancesById.get("fridge")!;
    assert.equal(runtimeAlone(fridge, 0.9).hours, 20);
    const rice = appliancesById.get("rice")!;
    assert.equal(runtimeAlone(rice, 1).uses, 2); // 1000 Wh / 350 Wh
  });

  test("runtimeTogether: sums average draw, adds only the largest surge", () => {
    const r = runtimeTogether({ aircon: 1, fridge: 2, unknown: 3, fan: 0 }, 1, 1);
    assert.equal(r.totalW, 500 + 90);
    assert.equal(r.peakW, 590 + 400); // aircon surge 400 > fridge surge 105
    assert.equal(r.overLimit, false);
    assert.ok(Math.abs(r.hours - 1000 / 590) < 1e-9);
    assert.equal(runtimeTogether({ kettle: 1 }, 1, 1).overLimit, true);
    assert.equal(runtimeTogether({ kettle: 1 }, 1, null).overLimit, false);
  });

  test("runtimeTogether with nothing selected", () => {
    assert.deepEqual(runtimeTogether({}, 5, 3), { totalW: 0, peakW: 0, hours: 0, overLimit: false });
  });

  test("rechargeHours needs panels", () => {
    assert.equal(rechargeHours(10, 0), null);
    assert.equal(rechargeHours(7.5, 2), 5);
  });

  test("formatDuration", () => {
    assert.equal(formatDuration(0), "—");
    assert.equal(formatDuration(NaN), "—");
    assert.equal(formatDuration(Infinity), "—");
    assert.equal(formatDuration(0.001), "1 min");
    assert.equal(formatDuration(0.5), "30 min");
    assert.equal(formatDuration(2), "2 h");
    assert.equal(formatDuration(2.26), "2 h 15 min");
    assert.equal(formatDuration(9.99), "10 h");
    assert.equal(formatDuration(12.4), "12 h");
    assert.equal(formatDuration(72), "3.0 days");
  });

  test("formatAlone uses the appliance's unit", () => {
    const usable = 9.025;
    assert.equal(formatAlone(appliancesById.get("rice")!, usable), "25 batches");
    assert.equal(formatAlone(appliancesById.get("phone")!, usable), "501 charges");
    assert.equal(formatAlone(appliancesById.get("microwave")!, 1.1), "60 min");
    assert.equal(formatAlone(appliancesById.get("microwave")!, usable), "8 h 10 min");
    assert.equal(formatAlone(appliancesById.get("fridge")!, 0), "—");
  });
});

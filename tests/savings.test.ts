import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { USABLE_FACTOR } from "@/lib/simulator/appliances";
import { DAYTIME_LOAD_SHARE, estimateSavings } from "@/lib/simulator/savings";

const close = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-6, msg ?? `${a} ≈ ${b}`);

describe("estimateSavings", () => {
  test("no solar: bill unchanged, nothing saved", () => {
    const r = estimateSavings({ usageKwh: 300, price: 0.2, exportRate: 0, yearlyKwh: 0, batteryKwh: 0 });
    close(r.billBefore, 60);
    close(r.billAfter, 60);
    close(r.monthlySavings, 0);
    close(r.coverage, 0);
  });

  test("small system: everything is used directly", () => {
    const r = estimateSavings({ usageKwh: 300, price: 0.2, exportRate: 0, yearlyKwh: 600, batteryKwh: 0 });
    close(r.solarKwh, 50);
    close(r.directKwh, 50);
    close(r.exportedKwh, 0);
    close(r.monthlySavings, 10);
    close(r.yearlySavings, 120);
  });

  test("daytime cap: excess is exported and credited at the export rate", () => {
    const r = estimateSavings({ usageKwh: 300, price: 0.2, exportRate: 0.1, yearlyKwh: 2400, batteryKwh: 0 });
    close(r.directKwh, 300 * DAYTIME_LOAD_SHARE);
    close(r.exportedKwh, 200 - 120);
    close(r.billAfter, (300 - 120) * 0.2 - 80 * 0.1);
  });

  test("battery covers evening use up to one usable cycle a day", () => {
    const r = estimateSavings({ usageKwh: 300, price: 0.2, exportRate: 0, yearlyKwh: 6000, batteryKwh: 1 });
    close(r.batteryKwh, Math.min(500 - 120, 300 - 120, USABLE_FACTOR * 30.4));
  });

  test("full net metering can't push the bill below zero; the rest is extra credit", () => {
    const r = estimateSavings({ usageKwh: 100, price: 0.3, exportRate: 0.3, yearlyKwh: 12000, batteryKwh: 0 });
    close(r.billAfter, 0);
    assert.ok(r.extraCredit > 0);
    close(r.monthlySavings, r.billBefore);
  });

  test("energy balances: direct + battery + exported = solar; coverage ≤ 1", () => {
    for (const usage of [0, 50, 300, 2000]) {
      for (const solar of [0, 1000, 8000, 50000]) {
        for (const batt of [0, 5, 30]) {
          const r = estimateSavings({ usageKwh: usage, price: 0.2, exportRate: 0.05, yearlyKwh: solar, batteryKwh: batt });
          close(r.directKwh + r.batteryKwh + r.exportedKwh, r.solarKwh);
          assert.ok(r.directKwh >= 0 && r.batteryKwh >= 0 && r.exportedKwh >= -1e-9);
          assert.ok(r.coverage >= 0 && r.coverage <= 1 + 1e-9);
          assert.ok(r.billAfter >= 0 && r.billAfter <= r.billBefore + 1e-9);
        }
      }
    }
  });

  test("NaN, negative and infinite inputs are treated as zero", () => {
    const r = estimateSavings({ usageKwh: NaN, price: -1, exportRate: Infinity, yearlyKwh: -5, batteryKwh: NaN });
    for (const v of Object.values(r)) assert.ok(Number.isFinite(v), "all outputs finite");
    close(r.billBefore, 0);
    close(r.monthlySavings, 0);
  });
});

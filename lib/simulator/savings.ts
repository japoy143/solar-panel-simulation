// Monthly bill savings from a solar layout. Pure functions; no React.
//
// Model, per average month:
// 1. Solar output = the layout's yearly estimate (summary.yearlyKwh) / 12.
// 2. Used directly: solar can only cover what the home uses while the sun is up. We assume
//    DAYTIME_LOAD_SHARE of monthly usage happens in daylight.
// 3. From the battery: leftover solar charges the battery and covers evening use, up to one
//    full usable cycle per day.
// 4. Exported: whatever is left goes to the grid, credited at `exportRate` (0 if the utility
//    pays nothing; equal to the price under full net metering).
// The bill figures cover energy charges only (kWh × price), not fixed or standing charges.
// Export credit can bring the bill to zero but not below: most net-metering schemes carry extra
// credit forward instead of paying it out, so it's reported separately (`extraCredit`).

import { USABLE_FACTOR } from "./appliances";

/** Share of a typical household's electricity used during daylight hours. */
export const DAYTIME_LOAD_SHARE = 0.4;
const DAYS_PER_MONTH = 30.4;

export type SavingsInput = {
  /** Household use per month (kWh). */
  usageKwh: number;
  /** What the household pays per kWh. */
  price: number;
  /** What the utility pays per exported kWh (feed-in tariff / net-metering credit). */
  exportRate: number;
  /** Solar output per year (kWh), from the layout summary. */
  yearlyKwh: number;
  /** Battery capacity (kWh), 0 if none. */
  batteryKwh: number;
};

export type SavingsResult = {
  solarKwh: number;
  directKwh: number;
  batteryKwh: number;
  exportedKwh: number;
  /** Share of the home's usage covered by solar (0–1). */
  coverage: number;
  billBefore: number;
  /** Never below zero. */
  billAfter: number;
  /** Export credit left over after the bill reaches zero (usually carried to the next bill). */
  extraCredit: number;
  monthlySavings: number;
  yearlySavings: number;
};

const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function estimateSavings(input: SavingsInput): SavingsResult {
  const usage = clean(input.usageKwh);
  const price = clean(input.price);
  const exportRate = clean(input.exportRate);
  const solar = clean(input.yearlyKwh) / 12;

  const direct = Math.min(solar, usage * DAYTIME_LOAD_SHARE);
  const batteryMonthly = clean(input.batteryKwh) * USABLE_FACTOR * DAYS_PER_MONTH;
  const fromBattery = Math.min(solar - direct, usage - direct, batteryMonthly);
  const exported = solar - direct - fromBattery;

  const billBefore = usage * price;
  const net = (usage - direct - fromBattery) * price - exported * exportRate;
  const billAfter = Math.max(0, net);
  const monthlySavings = billBefore - billAfter;

  return {
    solarKwh: solar,
    directKwh: direct,
    batteryKwh: fromBattery,
    exportedKwh: exported,
    coverage: usage > 0 ? (direct + fromBattery) / usage : 0,
    billBefore,
    billAfter,
    extraCredit: Math.max(0, -net),
    monthlySavings,
    yearlySavings: monthlySavings * 12,
  };
}

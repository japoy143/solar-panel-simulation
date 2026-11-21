import { getProduct } from "@/lib/catalog";
import type { PlacedItem } from "./geometry";

/**
 * Rough annual yield per installed kWp. This is a ballpark for a well-oriented roof,
 * NOT a site-specific estimate — real output depends on location, tilt, and shading.
 */
export const YIELD_KWH_PER_KWP = 1200;

export type LayoutSummary = {
  panels: number;
  kwp: number;
  yearlyKwh: number;
  inverterKw: number;
  batteryKwh: number;
  /** At least one hybrid (battery-ready) inverter is placed. */
  hasHybrid: boolean;
  /** Sum of the batteries' max continuous output (kW); null if a battery has no rating. */
  batteryOutputKw: number | null;
  /** Most power the backup system can deliver at once: the smaller of battery and hybrid inverter output. */
  backupLimitKw: number | null;
  products: { slug: string; name: string; count: number }[];
  warnings: string[];
  /** Fully assembled: panels feeding an inverter, and any batteries on a hybrid inverter. */
  live: boolean;
};

export function summarize(items: PlacedItem[]): LayoutSummary {
  let watts = 0;
  let panels = 0;
  let inverterKw = 0;
  let batteryKwh = 0;
  let hasHybrid = false;
  let hybridKw = 0;
  let batteryOutputKw: number | null = 0;
  const counts = new Map<string, number>();

  for (const item of items) {
    const p = getProduct(item.slug);
    if (!p) continue;
    counts.set(p.slug, (counts.get(p.slug) ?? 0) + 1);
    if (p.category === "panel") {
      panels += 1;
      watts += p.watts ?? 0;
    } else if (p.category === "inverter") {
      inverterKw += p.kw ?? 0;
      hasHybrid ||= Boolean(p.hybrid);
      if (p.hybrid) hybridKw += p.kw ?? 0;
    } else if (p.category === "battery") {
      batteryKwh += p.kwh ?? 0;
      batteryOutputKw = batteryOutputKw == null || p.kw == null ? null : batteryOutputKw + p.kw;
    }
  }

  const kwp = watts / 1000;
  if (batteryKwh === 0) batteryOutputKw = null;
  const limits = [batteryOutputKw, hybridKw > 0 ? hybridKw : null].filter((v): v is number => v != null);
  const backupLimitKw = limits.length > 0 ? Math.min(...limits) : null;
  const warnings: string[] = [];
  if (panels > 0 && inverterKw === 0) warnings.push("Add an inverter to convert the panels' power.");
  if (inverterKw > 0 && kwp > inverterKw * 1.3)
    warnings.push(`The array (${kwp.toFixed(1)} kWp) is large for ${inverterKw} kW of inverter capacity.`);
  if (batteryKwh > 0 && !hasHybrid) warnings.push("Batteries need a hybrid inverter.");

  return {
    panels,
    kwp,
    yearlyKwh: Math.round(kwp * YIELD_KWH_PER_KWP),
    inverterKw,
    batteryKwh,
    hasHybrid,
    batteryOutputKw,
    backupLimitKw,
    products: [...counts].map(([slug, count]) => ({
      slug,
      name: getProduct(slug)?.name ?? slug,
      count,
    })),
    warnings,
    live: panels > 0 && inverterKw > 0 && (batteryKwh === 0 || hasHybrid),
  };
}

/**
 * What still has to be placed before an estimate can be shown, as short instructions in build
 * order. Empty means the system is fully assembled. `battery: true` also requires a battery on a
 * hybrid inverter (backup power needs one; bill savings don't).
 */
export function missingParts(s: LayoutSummary, opts: { battery?: boolean } = {}): string[] {
  const missing: string[] = [];
  if (s.panels === 0) missing.push("Add solar panels to the roof");
  if (s.inverterKw === 0) missing.push(opts.battery ? "Add a hybrid inverter" : "Add an inverter");
  else if (!s.hasHybrid && (opts.battery || s.batteryKwh > 0)) missing.push("Swap in a hybrid inverter for the battery");
  if (opts.battery && s.batteryKwh === 0) missing.push("Add a battery");
  return missing;
}

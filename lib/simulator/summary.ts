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
    } else if (p.category === "battery") {
      batteryKwh += p.kwh ?? 0;
    }
  }

  const kwp = watts / 1000;
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
    products: [...counts].map(([slug, count]) => ({
      slug,
      name: getProduct(slug)?.name ?? slug,
      count,
    })),
    warnings,
    live: panels > 0 && inverterKw > 0 && (batteryKwh === 0 || hasHybrid),
  };
}

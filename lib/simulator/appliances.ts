// Battery runtime estimates in everyday terms. Pure functions + researched constants; no React.
//
// Figures are generic averages for a typical modern household appliance (not a specific model).
// Sources are listed in SOURCES and shown in the UI footnote.

/**
 * Share of a battery's rated capacity that reaches your outlets:
 * 95% depth of discharge × 95% conversion efficiency (LFP round-trip is typically 90–98%).
 */
export const DEPTH_OF_DISCHARGE = 0.95;
export const CONVERSION_EFFICIENCY = 0.95;
export const USABLE_FACTOR = DEPTH_OF_DISCHARGE * CONVERSION_EFFICIENCY;

/** Real-world panel output vs. nameplate (heat, dust, wiring, angle) when estimating recharge. */
export const SOLAR_DERATE = 0.75;

export type ApplianceUnit = "hours" | "batches" | "charges" | "uses" | "minutes" | "boils" | "loads";

export type ApplianceIcon =
  | "aircon"
  | "fridge"
  | "rice"
  | "tv"
  | "fan"
  | "light"
  | "router"
  | "laptop"
  | "phone"
  | "blender"
  | "microwave"
  | "kettle"
  | "washer"
  | "iron";

export type Appliance = {
  id: string;
  name: string;
  /** Short description of what's assumed. */
  detail: string;
  icon: ApplianceIcon;
  /** Average draw while in use (W). Cycling appliances (fridge, aircon) use their time-averaged draw. */
  avgW: number;
  /** Highest running draw (W) — used to check the battery's output limit. */
  peakW: number;
  /** How the "one at a time" result is expressed. */
  unit: ApplianceUnit;
  /** Energy per use for countable units (Wh), e.g. one rice batch. */
  whPerUse?: number;
};

export const APPLIANCES: Appliance[] = [
  {
    id: "aircon",
    name: "Air conditioner",
    detail: "Inverter, ~1 HP (9,000 BTU), room already cool",
    icon: "aircon",
    avgW: 500,
    peakW: 900,
    unit: "hours",
  },
  {
    id: "fridge",
    name: "Refrigerator",
    detail: "Modern, ~1 kWh a day; compressor runs about ⅓ of the time",
    icon: "fridge",
    avgW: 45,
    peakW: 150,
    unit: "hours",
  },
  {
    id: "rice",
    name: "Rice cooker",
    detail: "700 W, about 30 min per batch",
    icon: "rice",
    avgW: 700,
    peakW: 700,
    unit: "batches",
    whPerUse: 350,
  },
  { id: "tv", name: "LED TV", detail: '43–50"', icon: "tv", avgW: 70, peakW: 70, unit: "hours" },
  { id: "fan", name: "Electric fan", detail: "Stand or desk fan", icon: "fan", avgW: 50, peakW: 50, unit: "hours" },
  { id: "lights", name: "LED lights", detail: "5 bulbs × 9 W", icon: "light", avgW: 45, peakW: 45, unit: "hours" },
  { id: "router", name: "Wi-Fi router", detail: "Modem + router", icon: "router", avgW: 10, peakW: 10, unit: "hours" },
  { id: "laptop", name: "Laptop", detail: "While working, charger plugged in", icon: "laptop", avgW: 60, peakW: 60, unit: "hours" },
  {
    id: "phone",
    name: "Phone charging",
    detail: "Full charge ≈ 18 Wh including charger losses",
    icon: "phone",
    avgW: 10,
    peakW: 20,
    unit: "charges",
    whPerUse: 18,
  },
  {
    id: "blender",
    name: "Blender",
    detail: "400 W, about 2 min per use",
    icon: "blender",
    avgW: 400,
    peakW: 400,
    unit: "uses",
    whPerUse: (400 * 2) / 60,
  },
  {
    id: "microwave",
    name: "Microwave",
    detail: "1,100 W while heating",
    icon: "microwave",
    avgW: 1100,
    peakW: 1100,
    unit: "minutes",
  },
  {
    id: "kettle",
    name: "Electric kettle",
    detail: "2,000 W, 1 L boil ≈ 0.1 kWh",
    icon: "kettle",
    avgW: 2000,
    peakW: 2000,
    unit: "boils",
    whPerUse: 100,
  },
  {
    id: "washer",
    name: "Washing machine",
    detail: "About 0.5 kWh per load (cold wash)",
    icon: "washer",
    avgW: 500,
    peakW: 500,
    unit: "loads",
    whPerUse: 500,
  },
  { id: "iron", name: "Clothes iron", detail: "Dry iron, 1,000 W", icon: "iron", avgW: 1000, peakW: 1000, unit: "hours" },
];

export const appliancesById = new Map(APPLIANCES.map((a) => [a.id, a]));

/** Typical evening during an outage. */
export const DEFAULT_SCENARIO: Record<string, number> = {
  aircon: 1,
  fridge: 1,
  tv: 1,
  fan: 1,
  lights: 1,
  router: 1,
};

export const SOURCES = [
  { title: "Daft Logic — appliance power consumption table", url: "https://www.daftlogic.com/information-appliance-power-consumption.htm" },
  { title: "EcoFlow — 1 HP aircon to watts", url: "https://www.ecoflow.com/ph/blog/1hp-aircon-to-watts" },
  { title: "Midea — aircon electricity use by HP", url: "https://www.midea.com/ph/news/how-much-electricity-does-an-aircon-use-in-the-philippines" },
  { title: "Crompton — rice cooker wattage", url: "https://www.crompton.co.in/blogs/home-appliances/rice-cooker-wattage/" },
  { title: "U.S. DOE — energy use of typical home appliances", url: "https://sites.science.oregonstate.edu/~hetheriw/energy/quick/eff/EREC_Brief_Energy_Use_of_Some_Typical_Home_Appliances.htm" },
  { title: "Philippine DOE — refrigerator energy label list", url: "https://doe.gov.ph/sites/default/files/pdf/pelp/Attachment_B_Refrigerating_Appliances_Issuance_Reports_Jan-Jun_2024.pdf" },
  { title: "SolarEdge Energy Bank — LFP battery spec (DoD, efficiency)", url: "https://solarspechub.pages.dev/batteries/solaredge/solaredge-energy-bank/" },
];

export function usableKwh(batteryKwh: number) {
  return batteryKwh * USABLE_FACTOR;
}

/** Runtime for one appliance alone on a full battery. */
export function runtimeAlone(appliance: Appliance, usable: number) {
  const hours = (usable * 1000) / appliance.avgW;
  const uses = appliance.whPerUse ? Math.floor((usable * 1000) / appliance.whPerUse) : undefined;
  return { hours, uses };
}

/** Several appliances running at the same time. */
export function runtimeTogether(selection: Record<string, number>, usable: number, limitKw: number | null) {
  let totalW = 0;
  let surgeExtra = 0;
  for (const [id, qty] of Object.entries(selection)) {
    const a = appliancesById.get(id);
    if (!a || qty <= 0) continue;
    totalW += a.avgW * qty;
    // Motors don't all ramp up at the same instant: add only the largest single peak on top.
    surgeExtra = Math.max(surgeExtra, a.peakW - a.avgW);
  }
  const peakW = totalW + surgeExtra;
  return {
    totalW,
    peakW,
    hours: totalW > 0 ? (usable * 1000) / totalW : 0,
    overLimit: limitKw != null && peakW > limitKw * 1000,
  };
}

/** Hours of good sun for the panels to refill the usable capacity. */
export function rechargeHours(usable: number, kwp: number) {
  return kwp > 0 ? usable / (kwp * SOLAR_DERATE) : null;
}

export function formatDuration(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours >= 48) return `${(hours / 24).toFixed(1)} days`;
  if (hours >= 10) return `${Math.round(hours)} h`;
  // Under 10 h: hours + minutes, rounded to 5 min (these are estimates, not stopwatch figures).
  const total = Math.round((hours * 60) / 5) * 5;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The headline result for the "one at a time" card, in the appliance's own unit. */
export function formatAlone(appliance: Appliance, usable: number) {
  const { hours, uses } = runtimeAlone(appliance, usable);
  const n = (v: number) => v.toLocaleString("en-US");
  switch (appliance.unit) {
    case "hours":
      return formatDuration(hours);
    case "minutes":
      return hours >= 2 ? formatDuration(hours) : `${n(Math.floor(hours * 60))} min`;
    case "batches":
      return `${n(uses ?? 0)} batches`;
    case "charges":
      return `${n(uses ?? 0)} charges`;
    case "uses":
      return `${n(uses ?? 0)} uses`;
    case "boils":
      return `${n(uses ?? 0)} boils`;
    case "loads":
      return `${n(uses ?? 0)} loads`;
  }
}

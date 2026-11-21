import type { Product } from "@/lib/products";

const base = {
  summary: "",
  specs: [],
  priceCents: null,
  featured: false,
  active: true,
  sortOrder: 0,
  images: [],
};

export const panel: Product = {
  ...base,
  id: "p1",
  slug: "panel-410",
  name: "Panel 410 W",
  category: "panel",
  placement: "roof",
  size: { w: 1.13, h: 1.72, d: 0.035 },
  watts: 410,
};

export const inverter: Product = {
  ...base,
  id: "i1",
  slug: "string-5",
  name: "String inverter 5 kW",
  category: "inverter",
  placement: "wall",
  size: { w: 0.4, h: 0.5, d: 0.2 },
  kw: 5,
};

export const hybrid: Product = {
  ...inverter,
  id: "i2",
  slug: "hybrid-6",
  name: "Hybrid inverter 6 kW",
  kw: 6,
  hybrid: true,
};

export const battery: Product = {
  ...base,
  id: "b1",
  slug: "battery-10",
  name: "Battery 10 kWh",
  category: "battery",
  placement: "wall",
  size: { w: 0.6, h: 0.9, d: 0.2 },
  kwh: 10,
  kw: 5,
};

export const batteryNoRating: Product = { ...battery, id: "b2", slug: "battery-5", name: "Battery 5 kWh", kwh: 5, kw: undefined };

export const all = [panel, inverter, hybrid, battery, batteryNoRating];
export const lookup = (slug: string) => all.find((p) => p.slug === slug);

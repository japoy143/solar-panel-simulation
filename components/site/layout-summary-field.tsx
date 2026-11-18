"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGridIcon, XIcon } from "lucide-react";
import { getProduct } from "@/lib/catalog";
import { getBuilding } from "@/lib/simulator/buildings";
import { currentItems, useSimulator } from "@/lib/simulator/store";
import { summarize } from "@/lib/simulator/summary";

/** Shows the saved simulator layout in the booking form and submits it as a hidden field. */
export function LayoutSummaryField() {
  const [hydrated, setHydrated] = useState(false);
  const [included, setIncluded] = useState(true);
  const items = useSimulator(currentItems);
  const buildingId = useSimulator((s) => s.buildingId);

  useEffect(() => {
    void Promise.resolve(useSimulator.persist.rehydrate()).then(() => setHydrated(true));
  }, []);

  if (!hydrated) return null;

  if (items.length === 0 || !included) {
    return (
      <p className="text-sm text-muted-foreground sm:col-span-2">
        Want a head start?{" "}
        <Link href="/simulator" className="font-medium text-primary-strong underline-offset-4 hover:underline">
          Plan your layout in the simulator
        </Link>
        .
      </p>
    );
  }

  const building = getBuilding(buildingId);
  const summary = summarize(items);
  const parts = [
    building.name,
    `${summary.panels} panels`,
    `${summary.kwp.toFixed(1)} kWp`,
    ...summary.products.filter((p) => getProduct(p.slug)?.category !== "panel").map((p) => `${p.name} ×${p.count}`),
  ];
  const payload = JSON.stringify({ building: building.id, items, summary });

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:col-span-2">
      <LayoutGridIcon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="eyebrow text-primary-strong">Your layout</p>
        <p className="text-sm">{parts.join(" · ")}</p>
      </div>
      <button
        type="button"
        onClick={() => setIncluded(false)}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Don't include layout"
      >
        <XIcon className="size-4" />
      </button>
      <input type="hidden" name="layout" value={payload} />
    </div>
  );
}

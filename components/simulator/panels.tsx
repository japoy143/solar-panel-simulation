"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  BatteryFullIcon,
  RotateCwIcon,
  SunIcon,
  Trash2Icon,
  TriangleAlertIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCatalog, getProduct } from "@/lib/catalog";
import { categoryLabels, productImageUrl, productRating, type ProductCategory } from "@/lib/products";
import { buildings, getBuilding } from "@/lib/simulator/buildings";
import { buildingIcons } from "@/components/simulator/building-icons";
import { summarize } from "@/lib/simulator/summary";
import { currentItems, useSimulator } from "@/lib/simulator/store";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { clearLayoutWithUndo, removeItemWithUndo } from "./notify";


const categoryIcons: Record<ProductCategory, LucideIcon> = {
  panel: SunIcon,
  inverter: ZapIcon,
  battery: BatteryFullIcon,
};

function PanelSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="eyebrow text-primary-strong">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Scroll box for side-panel lists. Thin scrollbar, contained so the page doesn't scroll with it. */
const scrollList = "overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]";

export function BuildingPicker() {
  const buildingId = useSimulator((s) => s.buildingId);
  const layouts = useSimulator((s) => s.layouts);
  const setBuilding = useSimulator((s) => s.setBuilding);

  return (
    <PanelSection title="Building" hint={buildings.length > 4 ? `${buildings.length} layouts · scroll` : undefined}>
      {/* Rows are a fixed 3.75rem so exactly four fit: 2×2 on mobile, a column of 4 on desktop. */}
      <div
        className={cn(
          "grid auto-rows-[3.75rem] grid-cols-2 gap-2 lg:grid-cols-1",
          "max-h-[calc(2*3.75rem+0.5rem)] lg:max-h-[calc(4*3.75rem+3*0.5rem)]",
          scrollList,
        )}
      >
        {buildings.map((b) => {
          const Icon = buildingIcons[b.id];
          const active = b.id === buildingId;
          const count = layouts[b.id]?.length ?? 0;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBuilding(b.id)}
              aria-pressed={active}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
                active && "border-primary bg-primary/5 ring-1 ring-primary ring-inset",
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{b.name}</span>
                <span className="block truncate text-xs text-muted-foreground" title={b.dimensions}>
                  {b.dimensions}
                </span>
              </span>
              {count > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 font-mono text-xs text-primary-strong">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </PanelSection>
  );
}

export function Palette() {
  const pendingSlug = useSimulator((s) => s.pendingSlug);
  const setPending = useSimulator((s) => s.setPending);
  const categories = Object.keys(categoryLabels) as ProductCategory[];

  return (
    <PanelSection title="Products">
      <p className="text-xs text-muted-foreground">
        Drag onto the building, or tap one and then tap a highlighted area.
      </p>
      {/* Scrolls on its own so every product stays within drag distance of the canvas. */}
      <div className={cn("max-h-80 space-y-4 lg:max-h-[min(26rem,calc(100svh-30rem))] lg:min-h-48", scrollList)}>
        {categories.map((category) => {
          const Icon = categoryIcons[category];
          const inCategory = getCatalog().filter((p) => p.category === category);
          if (inCategory.length === 0) return null;
          return (
            <div key={category} className="space-y-1.5">
              <p className="sticky top-0 z-10 bg-background py-1 text-xs font-medium text-muted-foreground">
                {categoryLabels[category]}
              </p>
              {inCategory.map((p) => {
                  const active = pendingSlug === p.slug;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", p.slug);
                        e.dataTransfer.effectAllowed = "copy";
                        setPending(p.slug);
                      }}
                      onDragEnd={() => setPending(null)}
                      onClick={() => setPending(active ? null : p.slug)}
                      aria-pressed={active}
                      className={cn(
                        "flex w-full cursor-grab items-center gap-3 rounded-lg border bg-background p-2.5 text-left transition-colors hover:bg-muted/60 active:cursor-grabbing",
                        active && "border-primary bg-primary/5 ring-1 ring-primary ring-inset",
                      )}
                    >
                      {p.images[0] ? (
                        <Image
                          src={productImageUrl(p.images[0])}
                          alt=""
                          width={32}
                          height={32}
                          draggable={false}
                          className="size-8 shrink-0 rounded-md bg-muted object-cover"
                        />
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="size-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {productRating(p)} · {p.placement === "roof" ? "Roof" : "Wall"}
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </PanelSection>
  );
}

export function Inspector({ onRotate, rotateError }: { onRotate: () => void; rotateError: boolean }) {
  const selectedId = useSimulator((s) => s.selectedId);
  const items = useSimulator(currentItems);
  const buildingId = useSimulator((s) => s.buildingId);
  const item = items.find((it) => it.id === selectedId);
  const product = item && getProduct(item.slug);
  const surface = item && getBuilding(buildingId).surfaces.find((s) => s.id === item.surfaceId);

  return (
    <Card size="sm">
      <CardHeader>
        <p className="eyebrow text-primary-strong">Selected</p>
        <CardTitle className="font-semibold">{product ? product.name : "Nothing selected"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {item && product ? (
          <>
            <p className="text-xs text-muted-foreground">
              {surface?.label} · {item.rotation === 90 ? "Landscape" : "Portrait"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-9 flex-1" onClick={onRotate}>
                <RotateCwIcon data-icon="inline-start" />
                Rotate <kbd className="font-mono text-xs text-muted-foreground">R</kbd>
              </Button>
              <Button variant="destructive" className="h-9 flex-1" onClick={() => removeItemWithUndo(item.id)}>
                <Trash2Icon data-icon="inline-start" />
                Remove
              </Button>
            </div>
            {rotateError && <p className="text-xs text-destructive">No room to rotate it here.</p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Click an item to select it, then drag to move. <kbd className="font-mono">R</kbd> rotates,{" "}
            <kbd className="font-mono">Del</kbd> removes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function SummaryCard() {
  const items = useSimulator(currentItems);
  const buildingId = useSimulator((s) => s.buildingId);
  const confirm = useConfirm();
  const summary = summarize(items);
  const stats = [
    { label: "Panels", value: String(summary.panels) },
    { label: "System", value: `${summary.kwp.toFixed(1)} kWp` },
    { label: "Est. / year", value: `${summary.yearlyKwh.toLocaleString("en-US")} kWh` },
    { label: "Inverter", value: summary.inverterKw ? `${summary.inverterKw} kW` : "—" },
    { label: "Battery", value: summary.batteryKwh ? `${summary.batteryKwh} kWh` : "—" },
  ];

  return (
    <Card size="sm">
      <CardHeader>
        <p className="eyebrow text-primary-strong">Your layout</p>
        <CardTitle className="font-semibold">{getBuilding(buildingId).name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
          {stats.map((s) => (
            <div key={s.label} className="space-y-0.5">
              <dt className="eyebrow text-muted-foreground">{s.label}</dt>
              <dd className="font-heading text-lg font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        {summary.products.length > 0 && (
          <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
            {summary.products.map((p) => (
              <li key={p.slug} className="flex justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="font-mono">×{p.count}</span>
              </li>
            ))}
          </ul>
        )}

        {summary.warnings.length > 0 && (
          <ul className="space-y-1.5">
            {summary.warnings.map((w) => (
              <li key={w} className="flex gap-2 text-xs text-destructive">
                <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground">
          Yearly output is a rough estimate. We confirm real figures on site.
        </p>

        <div className="flex flex-col gap-2">
          <Link
            href="/booking"
            aria-disabled={items.length === 0}
            className={cn(
              buttonVariants(),
              "h-10",
              items.length === 0 && "pointer-events-none opacity-50",
            )}
          >
            Book with this layout
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
          <Button
            variant="ghost"
            className="h-9 text-muted-foreground"
            disabled={items.length === 0}
            onClick={async () => {
              const ok = await confirm({
                title: "Clear this layout?",
                description: `All ${items.length} item${items.length === 1 ? "" : "s"} on the ${getBuilding(buildingId).name.toLowerCase()} will be removed. You can undo this right after.`,
                confirmLabel: "Clear layout",
                variant: "destructive",
              });
              if (ok) clearLayoutWithUndo();
            }}
          >
            Clear layout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

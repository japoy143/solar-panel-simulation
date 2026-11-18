"use client";

import { useId, useMemo, useState } from "react";
import {
  AirVentIcon,
  BatteryChargingIcon,
  BlendIcon,
  ChevronDownIcon,
  CookingPotIcon,
  CupSodaIcon,
  FanIcon,
  LaptopIcon,
  LightbulbIcon,
  MicrowaveIcon,
  MinusIcon,
  PlusIcon,
  RefrigeratorIcon,
  RouterIcon,
  ShirtIcon,
  SmartphoneIcon,
  SunIcon,
  TvIcon,
  WashingMachineIcon,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  APPLIANCES,
  formatAlone,
  formatDuration,
  rechargeHours,
  runtimeTogether,
  SOURCES,
  USABLE_FACTOR,
  usableKwh,
  type ApplianceIcon,
} from "@/lib/simulator/appliances";
import { currentItems, useSimulator } from "@/lib/simulator/store";
import { summarize } from "@/lib/simulator/summary";
import { cn } from "@/lib/utils";

const icons: Record<ApplianceIcon, LucideIcon> = {
  aircon: AirVentIcon,
  fridge: RefrigeratorIcon,
  rice: CookingPotIcon,
  tv: TvIcon,
  fan: FanIcon,
  light: LightbulbIcon,
  router: RouterIcon,
  laptop: LaptopIcon,
  phone: SmartphoneIcon,
  blender: BlendIcon,
  microwave: MicrowaveIcon,
  kettle: CupSodaIcon,
  washer: WashingMachineIcon,
  iron: ShirtIcon,
};

const PREVIEW_KWH = 10;
const watts = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(w % 1000 ? 1 : 0)} kW` : `${w} W`);

type Tab = "alone" | "together";

/** "How long does the battery last?" — shown under the 3D view. */
export function BackupPower() {
  const items = useSimulator(currentItems);
  const summary = useMemo(() => summarize(items), [items]);
  const [tab, setTab] = useState<Tab>("alone");
  const tabsId = useId();

  const hasBattery = summary.batteryKwh > 0;
  const capacity = hasBattery ? summary.batteryKwh : PREVIEW_KWH;
  const usable = usableKwh(capacity);
  const limitKw = hasBattery ? summary.backupLimitKw : null;
  const recharge = hasBattery ? rechargeHours(usable, summary.kwp) : null;

  return (
    <Card className="mt-4">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="eyebrow text-primary-strong">Backup power</p>
            <CardTitle className="text-lg font-semibold">
              {hasBattery ? "What a full charge runs" : "How long would a battery last?"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {hasBattery ? (
                <>
                  <strong className="font-medium text-foreground">{usable.toFixed(1)} kWh usable</strong> of{" "}
                  {capacity} kWh
                  {limitKw != null && <> · up to {limitKw} kW at once</>}
                </>
              ) : (
                <>Add a battery to see how long it powers your home. Preview shown for {PREVIEW_KWH} kWh.</>
              )}
            </p>
          </div>
          {recharge != null && (
            <p className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary-strong">
              <SunIcon className="size-3.5" />
              Refills in ~{formatDuration(recharge)} of good sun
            </p>
          )}
        </div>

        <div role="tablist" aria-label="Backup estimate" className="flex w-fit rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ["alone", "One at a time"],
              ["together", "Together"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`${tabsId}-${value}`}
              aria-selected={tab === value}
              aria-controls={`${tabsId}-${value}-panel`}
              onClick={() => setTab(value)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                tab === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent
        id={`${tabsId}-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${tab}`}
        className={cn("space-y-4", !hasBattery && "opacity-60")}
      >
        {tab === "alone" ? (
          <AloneGrid usable={usable} limitKw={limitKw} />
        ) : (
          <Together usable={usable} limitKw={limitKw} />
        )}
        <Footnote />
      </CardContent>
    </Card>
  );
}

function AloneGrid({ usable, limitKw }: { usable: number; limitKw: number | null }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {APPLIANCES.map((a) => {
        const Icon = icons[a.icon];
        const tooPowerful = limitKw != null && a.peakW > limitKw * 1000;
        return (
          <li key={a.id} className="flex flex-col gap-2 rounded-lg border p-3" title={a.detail}>
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{a.name}</span>
                <span className="block font-mono text-[11px] text-muted-foreground">~{watts(a.avgW)}</span>
              </span>
            </div>
            {tooPowerful ? (
              <p className="text-xs font-medium text-destructive">Needs more than {limitKw} kW</p>
            ) : (
              <p className="font-heading text-xl font-semibold tabular-nums text-primary-strong">
                {formatAlone(a, usable)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Together({ usable, limitKw }: { usable: number; limitKw: number | null }) {
  const scenario = useSimulator((s) => s.backupScenario);
  const setQty = useSimulator((s) => s.setApplianceQty);
  const result = runtimeTogether(scenario, usable, limitKw);
  const loadPct = limitKw ? Math.min(100, (result.peakW / (limitKw * 1000)) * 100) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {APPLIANCES.map((a) => {
          const Icon = icons[a.icon];
          const qty = scenario[a.id] ?? 0;
          const on = qty > 0;
          return (
            <li
              key={a.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2 transition-colors",
                on && "border-primary/40 bg-primary/5",
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-primary"
                  checked={on}
                  onChange={(e) => setQty(a.id, e.target.checked ? 1 : 0)}
                />
                <Icon className={cn("size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{a.name}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">{watts(a.avgW)} each</span>
                </span>
              </label>
              {on && (
                <div className="flex items-center gap-1" aria-label={`${a.name} quantity`}>
                  <button
                    type="button"
                    className="flex size-6 items-center justify-center rounded-md border hover:bg-muted"
                    aria-label={`Fewer ${a.name}`}
                    onClick={() => setQty(a.id, qty - 1)}
                  >
                    <MinusIcon className="size-3" />
                  </button>
                  <span className="w-4 text-center font-mono text-xs tabular-nums">{qty}</span>
                  <button
                    type="button"
                    className="flex size-6 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-40"
                    aria-label={`More ${a.name}`}
                    disabled={qty >= 9}
                    onClick={() => setQty(a.id, qty + 1)}
                  >
                    <PlusIcon className="size-3" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div
        className={cn(
          "flex flex-col gap-3 self-start rounded-xl border p-4 lg:sticky lg:top-4",
          result.overLimit ? "border-destructive/40 bg-destructive/5" : "bg-muted/40",
        )}
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BatteryChargingIcon className="size-4 text-primary" />
          Running together
        </div>
        {result.totalW === 0 ? (
          <p className="text-sm text-muted-foreground">Tick the appliances you&apos;d run at the same time.</p>
        ) : (
          <>
            <div>
              <p className="eyebrow text-muted-foreground">Lasts about</p>
              <p className="font-heading text-3xl font-semibold tabular-nums text-primary-strong">
                {formatDuration(result.hours)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Average load</dt>
                <dd className="font-mono tabular-nums">{watts(result.totalW)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Peak load</dt>
                <dd className="font-mono tabular-nums">{watts(result.peakW)}</dd>
              </div>
            </dl>
            {loadPct != null && (
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-background ring-1 ring-foreground/10">
                  <div
                    className={cn("h-full rounded-full", result.overLimit ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${loadPct}%` }}
                  />
                </div>
                <p className={cn("text-xs", result.overLimit ? "text-destructive" : "text-muted-foreground")}>
                  {result.overLimit
                    ? `Too much at once: peak ${watts(result.peakW)} is over the ${limitKw} kW limit. Turn something off or add a bigger battery/inverter.`
                    : `${Math.round(loadPct)}% of the ${limitKw} kW the system can deliver`}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Footnote() {
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" />
        Estimates for a full battery with no solar input (e.g. at night or in an outage). How we calculate this
      </summary>
      <div className="mt-2 space-y-2 pl-4.5">
        <p>
          Usable energy is {Math.round(USABLE_FACTOR * 100)}% of the battery&apos;s rated capacity (95% depth of
          discharge × 95% conversion efficiency, typical for LFP home batteries). Appliance figures are averages for
          common modern models; fridges and inverter aircons cycle, so their average is well below their rated power.
          Your appliances&apos; labels, settings and the weather will change real results.
        </p>
        <ul className="list-disc space-y-0.5 pl-4">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

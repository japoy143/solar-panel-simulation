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
import { Card } from "@/components/ui/card";
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
import { missingParts, summarize } from "@/lib/simulator/summary";
import { cn } from "@/lib/utils";
import { DisclosureButton, DisclosurePanel } from "./disclosure";
import { SetupSteps } from "./setup-steps";

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

const watts = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(w % 1000 ? 1 : 0)} kW` : `${w} W`);
/** How many checked appliances get a quick "alone" figure on the collapsed card. */
const MAX_HIGHLIGHTS = 3;

type Tab = "alone" | "together";

/**
 * "How long does the battery last?" — compact card under the 3D view. Collapsed, it shows the
 * runtime for the selected appliances running together; expanded, the per-appliance figures and
 * the appliance picker. Figures only appear once the system is fully assembled (panels, a hybrid
 * inverter and a battery); until then it lists what's missing. Appliances can be picked anytime.
 */
export function BackupPower() {
  const items = useSimulator(currentItems);
  const scenario = useSimulator((s) => s.backupScenario);
  const summary = useMemo(() => summarize(items), [items]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("together");
  const ids = useId();

  const missing = missingParts(summary, { battery: true });
  const ready = missing.length === 0;
  const capacity = summary.batteryKwh;
  const usable = usableKwh(capacity);
  const limitKw = ready ? summary.backupLimitKw : null;
  const recharge = ready ? rechargeHours(usable, summary.kwp) : null;
  const together = runtimeTogether(scenario, usable, limitKw);
  // Only appliances the visitor has checked (in list order); unknown ids from old saves are ignored.
  const selected = APPLIANCES.filter((a) => (scenario[a.id] ?? 0) > 0);
  const selectedCount = selected.length;
  const highlights = selected.slice(0, MAX_HIGHLIGHTS);
  const moreCount = selectedCount - highlights.length;

  return (
    <Card className="@container gap-0 py-5">
      <div className="space-y-4 px-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow flex items-center gap-1.5 text-primary-strong">
            <BatteryChargingIcon className="size-3.5" />
            Backup power
          </p>
          {recharge != null && (
            <p className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary-strong">
              <SunIcon className="size-3" />
              Refills in ~{formatDuration(recharge)}
            </p>
          )}
        </div>

        {!ready ? (
          <SetupSteps title="Finish your system to see how long the battery lasts:" steps={missing} />
        ) : (
          <>
            <div>
              {together.totalW > 0 ? (
                <>
                  <p className="font-heading text-4xl font-semibold text-primary-strong tabular-nums">
                    ~{formatDuration(together.hours)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    running your {selectedCount} selected appliance{selectedCount === 1 ? "" : "s"} together
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Pick the appliances you&apos;d run in an outage.</p>
              )}
              {together.overLimit && (
                <p className="mt-1 text-xs font-medium text-destructive">
                  Peak {watts(together.peakW)} is over the {limitKw} kW the system can deliver.
                </p>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">{usable.toFixed(1)} kWh usable</strong> of {capacity} kWh
              {limitKw != null && <> · up to {limitKw} kW at once</>}
            </p>

            {highlights.length > 0 && (
              <div className="space-y-1.5">
                <ul className="grid grid-cols-3 gap-2">
                  {highlights.map((a) => {
                    const Icon = icons[a.icon];
                    return (
                      <li key={a.id} className="min-w-0 rounded-lg bg-muted/60 px-3 py-2.5" title={`${a.name} alone`}>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Icon className="size-3 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </span>
                        <span className="mt-0.5 block text-base font-semibold tabular-nums">{formatAlone(a, usable)}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Each on its own{moreCount > 0 && <> · +{moreCount} more selected</>}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <DisclosurePanel id={`${ids}-panel`} open={open}>
        <div className="space-y-4 border-t px-5 py-5">
          {!ready ? (
            <Together usable={usable} limitKw={limitKw} showResults={false} />
          ) : (
            <>
              <div role="tablist" aria-label="Backup estimate" className="flex w-full rounded-lg bg-muted p-1 text-sm">
                {(
                  [
                    ["together", "Together"],
                    ["alone", "One at a time"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    id={`${ids}-${value}`}
                    aria-selected={tab === value}
                    aria-controls={`${ids}-${value}-panel`}
                    onClick={() => setTab(value)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-2 font-medium transition-colors",
                      tab === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div id={`${ids}-${tab}-panel`} role="tabpanel" aria-labelledby={`${ids}-${tab}`}>
                {tab === "alone" ? (
                  <AloneList usable={usable} limitKw={limitKw} />
                ) : (
                  <Together usable={usable} limitKw={limitKw} showResults />
                )}
              </div>
              <Footnote />
            </>
          )}
        </div>
      </DisclosurePanel>

      <div className="px-3 pt-2">
        <DisclosureButton
          open={open}
          onToggle={() => setOpen((o) => !o)}
          controls={`${ids}-panel`}
          openLabel="Hide details"
          closedLabel={ready ? "Choose appliances & see each one" : "Choose appliances"}
        />
      </div>
    </Card>
  );
}

function AloneList({ usable, limitKw }: { usable: number; limitKw: number | null }) {
  return (
    <ul className="-mr-2 grid max-h-96 gap-x-3 overflow-y-auto overscroll-contain pr-2 @sm:grid-cols-2">
      {APPLIANCES.map((a) => {
        const Icon = icons[a.icon];
        const tooPowerful = limitKw != null && a.peakW > limitKw * 1000;
        return (
          <li key={a.id} className="flex items-center gap-2 border-b py-2.5 text-sm last:border-b-0" title={a.detail}>
            <Icon className="size-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
            {tooPowerful ? (
              <span className="shrink-0 text-xs font-medium text-destructive">&gt; {limitKw} kW</span>
            ) : (
              <span className="shrink-0 font-medium text-primary-strong tabular-nums">{formatAlone(a, usable)}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Together({
  usable,
  limitKw,
  showResults,
}: {
  usable: number;
  limitKw: number | null;
  /** False until the system is assembled: just the picker, no load or runtime figures. */
  showResults: boolean;
}) {
  const scenario = useSimulator((s) => s.backupScenario);
  const setQty = useSimulator((s) => s.setApplianceQty);
  const result = runtimeTogether(scenario, usable, limitKw);
  const loadPct = limitKw ? Math.min(100, (result.peakW / (limitKw * 1000)) * 100) : null;

  return (
    <div className="space-y-4">
      {showResults && result.totalW > 0 && (
        <div className="space-y-2" aria-live="polite">
          <dl className="flex justify-between text-sm">
            <div>
              <dt className="inline text-muted-foreground">Average </dt>
              <dd className="inline font-mono tabular-nums">{watts(result.totalW)}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Peak </dt>
              <dd className="inline font-mono tabular-nums">{watts(result.peakW)}</dd>
            </div>
          </dl>
          {loadPct != null && (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={cn("h-full rounded-full", result.overLimit ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${loadPct}%` }}
                />
              </div>
              <p className={cn("text-xs", result.overLimit ? "text-destructive" : "text-muted-foreground")}>
                {result.overLimit
                  ? "Too much at once. Turn something off or add a bigger battery/inverter."
                  : `${Math.round(loadPct)}% of the ${limitKw} kW the system can deliver`}
              </p>
            </>
          )}
        </div>
      )}

      <ul className="-mr-2 grid max-h-96 gap-1.5 overflow-y-auto overscroll-contain pr-2 @md:grid-cols-2">
        {APPLIANCES.map((a) => {
          const Icon = icons[a.icon];
          const qty = scenario[a.id] ?? 0;
          const on = qty > 0;
          return (
            <li
              key={a.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors",
                on && "border-primary/40 bg-primary/5",
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-3.5 shrink-0 accent-primary"
                  checked={on}
                  onChange={(e) => setQty(a.id, e.target.checked ? 1 : 0)}
                />
                <Icon className={cn("size-3.5 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
                <span className="min-w-0 truncate text-sm">{a.name}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">{watts(a.avgW)}</span>
              </label>
              {on && (
                <div className="flex items-center gap-0.5" aria-label={`${a.name} quantity`}>
                  <button
                    type="button"
                    className="flex size-5 items-center justify-center rounded border hover:bg-muted"
                    aria-label={`Fewer ${a.name}`}
                    onClick={() => setQty(a.id, qty - 1)}
                  >
                    <MinusIcon className="size-3" />
                  </button>
                  <span className="w-4 text-center font-mono text-xs tabular-nums">{qty}</span>
                  <button
                    type="button"
                    className="flex size-5 items-center justify-center rounded border hover:bg-muted disabled:opacity-40"
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
    </div>
  );
}

function Footnote() {
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" />
        Full battery, no solar input (night or outage). How we calculate this
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

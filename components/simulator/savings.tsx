"use client";

import { useId, useMemo, useState } from "react";
import { BatteryChargingIcon, PiggyBankIcon, RotateCcwIcon, SunIcon, UtilityPoleIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { estimateSavings, DAYTIME_LOAD_SHARE } from "@/lib/simulator/savings";
import { currentItems, useSimulator, type SavingsSettings } from "@/lib/simulator/store";
import { summarize } from "@/lib/simulator/summary";
import { currencyCodes, detectCountry, getTariff, TARIFF_SOURCES, TARIFFS } from "@/lib/simulator/tariffs";
import { cn } from "@/lib/utils";
import { DisclosureButton, DisclosurePanel } from "./disclosure";

const DEFAULT_USAGE_KWH = 300;

function presetSettings(code: string): SavingsSettings {
  const t = getTariff(code) ?? TARIFFS[0];
  return { country: t.code, currency: t.currency, price: t.price, usageKwh: DEFAULT_USAGE_KWH, exportRate: 0 };
}

/** "₱4,320" — whole units for big amounts, cents for small ones. Never throws on a bad code. */
function money(n: number, currency: string, opts: Intl.NumberFormatOptions = {}) {
  const digits = Math.abs(n) >= 100 ? 0 : undefined;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      ...opts,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

const rate = (n: number, currency: string) => money(n, currency, { minimumFractionDigits: undefined, maximumFractionDigits: 4 });
const kwh = (n: number) => `${Math.round(n).toLocaleString()} kWh`;

const fieldClass =
  "h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Bill savings for the current layout, using the visitor's electricity price and usage. */
export function Savings() {
  const items = useSimulator(currentItems);
  const stored = useSimulator((s) => s.savings);
  const setSavings = useSimulator((s) => s.setSavings);
  const summary = useMemo(() => summarize(items), [items]);
  const [detected] = useState(detectCountry);
  const settings = stored ?? presetSettings(detected);
  const update = (patch: Partial<SavingsSettings>) => setSavings({ ...settings, ...patch });

  const preset = getTariff(settings.country);
  const offPreset = preset && (preset.price !== settings.price || preset.currency !== settings.currency);
  const result = estimateSavings({
    usageKwh: settings.usageKwh,
    price: settings.price,
    exportRate: settings.exportRate,
    yearlyKwh: summary.yearlyKwh,
    batteryKwh: summary.batteryKwh,
  });
  const cur = settings.currency;
  const hasSolar = summary.panels > 0;
  const ids = useId();

  const [open, setOpen] = useState(false);
  const fromSolar = Math.round(result.coverage * 100);

  return (
    <Card className="@container gap-0 py-5">
      {/* Always visible: the headline */}
      <div className="space-y-4 px-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow flex items-center gap-1.5 text-primary-strong">
            <PiggyBankIcon className="size-3.5" />
            Savings
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {preset && !offPreset ? preset.name : "Your rate"} · {rate(settings.price, cur)}/kWh
          </p>
        </div>

        {!hasSolar ? (
          <div>
            <p className="font-heading text-4xl font-semibold text-muted-foreground/60 tabular-nums">
              {money(0, cur)}
              <span className="text-base font-medium"> / month</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Add panels to see your savings. Your bill now: about{" "}
              <strong className="font-medium text-foreground">{money(result.billBefore, cur)}</strong> a month.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="font-heading text-4xl font-semibold text-primary-strong tabular-nums">
                {money(result.monthlySavings, cur)}
                <span className="text-base font-medium text-muted-foreground"> / month</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                {money(result.yearlySavings, cur)} a year · {fromSolar}% of your usage from solar
              </p>
            </div>
            <BillBars before={result.billBefore} after={result.billAfter} currency={cur} />
            {result.extraCredit > 0.5 && (
              <p className="text-xs text-primary-strong">
                + {money(result.extraCredit, cur)} export credit a month beyond your bill, usually carried over.
              </p>
            )}
          </>
        )}
        <p className="text-sm text-muted-foreground">
          Based on {kwh(settings.usageKwh)} a month
          {settings.exportRate > 0 ? `, exports credited at ${rate(settings.exportRate, cur)}/kWh` : ""}.
        </p>
      </div>

      {/* Expanded: price, currency, usage */}
      <DisclosurePanel id={`${ids}-panel`} open={open}>
        <div className="space-y-5 border-t px-5 py-5">
          <div className="grid gap-4 @md:grid-cols-2">
            <Field label="Country" htmlFor={`${ids}-country`}>
              <select
                id={`${ids}-country`}
                value={preset ? settings.country : "custom"}
                onChange={(e) => {
                  const t = getTariff(e.target.value);
                  if (t) update({ country: t.code, currency: t.currency, price: t.price });
                }}
                className={fieldClass}
              >
                {!preset && <option value="custom">Custom rate</option>}
                {TARIFFS.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
              <Field label="Price per kWh" htmlFor={`${ids}-price`}>
                <NumberInput
                  id={`${ids}-price`}
                  value={settings.price}
                  onChange={(price) => update({ price })}
                  suffix={`/kWh`}
                />
              </Field>
              <Field label="Currency" htmlFor={`${ids}-currency`}>
                <CurrencySelect id={`${ids}-currency`} value={cur} onChange={(currency) => update({ currency })} />
              </Field>
            </div>
          </div>

          {preset && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {offPreset ? (
                <button
                  type="button"
                  onClick={() => update({ currency: preset.currency, price: preset.price })}
                  className="inline-flex items-center gap-1 font-medium text-primary-strong hover:underline"
                >
                  <RotateCcwIcon className="size-3" />
                  Use {preset.name} average ({rate(preset.price, preset.currency)}/kWh)
                </button>
              ) : (
                <>
                  {preset.name} average ·{" "}
                  <a
                    href={TARIFF_SOURCES[preset.source].url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {TARIFF_SOURCES[preset.source].label}, {TARIFF_SOURCES[preset.source].period}
                  </a>
                </>
              )}
              {settings.currency !== preset.currency && (
                <span className="block">Changing the currency doesn&apos;t convert the price. Enter the rate in {cur}.</span>
              )}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Monthly usage" htmlFor={`${ids}-usage`}>
              <NumberInput
                id={`${ids}-usage`}
                value={settings.usageKwh}
                onChange={(usageKwh) => update({ usageKwh })}
                suffix="kWh"
                round={0}
              />
            </Field>
            <Field label="or monthly bill" htmlFor={`${ids}-bill`}>
              <NumberInput
                id={`${ids}-bill`}
                value={settings.usageKwh * settings.price}
                onChange={(bill) => settings.price > 0 && update({ usageKwh: bill / settings.price })}
                suffix={cur}
                round={0}
              />
            </Field>
          </div>

          <div className="space-y-1.5">
            <Field label="Paid for solar sent to the grid" htmlFor={`${ids}-export`}>
              <NumberInput
                id={`${ids}-export`}
                value={settings.exportRate}
                onChange={(exportRate) => update({ exportRate })}
                suffix="/kWh"
              />
            </Field>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(
                [
                  ["Nothing", 0],
                  ["Net metering", settings.price],
                ] as const
              ).map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => update({ exportRate: value })}
                  className={cn(
                    "rounded-full border px-3 py-1 font-medium transition-colors hover:bg-muted",
                    settings.exportRate === value && "border-primary/40 bg-primary/10 text-primary-strong",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {hasSolar && (
            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <UsageBar usage={settings.usageKwh} direct={result.directKwh} battery={result.batteryKwh} />
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <Legend icon={SunIcon} swatch="bg-primary" label="Solar, used as it's made" value={kwh(result.directKwh)} />
                {summary.batteryKwh > 0 && (
                  <Legend icon={BatteryChargingIcon} swatch="bg-primary/50" label="Solar, from the battery" value={kwh(result.batteryKwh)} />
                )}
                <Legend
                  icon={UtilityPoleIcon}
                  swatch="bg-muted-foreground/30"
                  label="Still from the grid"
                  value={kwh(Math.max(0, settings.usageKwh - result.directKwh - result.batteryKwh))}
                />
              </ul>
              {result.exportedKwh > 0.5 && (
                <p className="text-xs text-muted-foreground">
                  {kwh(result.exportedKwh)} of solar a month goes to the grid
                  {settings.exportRate > 0
                    ? `, credited ${money(result.exportedKwh * settings.exportRate, cur)}.`
                    : summary.batteryKwh > 0
                      ? "."
                      : ". A battery would let you use more of it."}
                </p>
              )}
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            Average month: {summary.yearlyKwh.toLocaleString()} kWh of solar a year, about{" "}
            {Math.round(DAYTIME_LOAD_SHARE * 100)}% of home use in daylight, a battery cycled once a day. Energy charges
            only (not fixed or standing charges). Country rates are averages; tiers and providers vary.
          </p>
        </div>
      </DisclosurePanel>

      <div className="px-3 pt-2">
        <DisclosureButton
          open={open}
          onToggle={() => setOpen((o) => !o)}
          controls={`${ids}-panel`}
          openLabel="Hide settings"
          closedLabel="Set your price, currency & usage"
        />
      </div>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="eyebrow block text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * A number box that lets people type freely ("0.", empty) and only reports valid numbers.
 * Shows the outside value again when it changes elsewhere (e.g. picking another country).
 */
function NumberInput({
  id,
  value,
  onChange,
  suffix,
  round,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  suffix: string;
  /** Decimal places to show for the outside value. */
  round?: number;
}) {
  const shown = round == null ? String(+value.toFixed(4)) : value.toFixed(round);
  const [text, setText] = useState(shown);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (Number(text) !== value) setText(shown);
  }
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(",", ".");
          if (!/^\d*\.?\d*$/.test(next)) return;
          setText(next);
          const n = Number(next);
          if (next !== "" && Number.isFinite(n)) {
            setSynced(n);
            onChange(n);
          }
        }}
        onBlur={() => setText(shown)}
        className={cn(fieldClass, "pr-14 tabular-nums")}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

function CurrencySelect({ id, value, onChange }: { id: string; value: string; onChange: (c: string) => void }) {
  const codes = useMemo(() => {
    const all = currencyCodes();
    return all.includes(value) ? all : [value, ...all];
  }, [value]);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
      {codes.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

function BillBars({ before, after, currency }: { before: number; after: number; currency: string }) {
  const max = Math.max(before, 1);
  const rows = [
    { label: "Now", value: before, className: "bg-muted-foreground/40" },
    { label: "With solar", value: after, className: "bg-primary" },
  ];
  return (
    <dl className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <dt className="text-muted-foreground">{r.label}</dt>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", r.className)}
              style={{ width: `${Math.max(0, Math.min(1, r.value / max)) * 100}%` }}
            />
          </div>
          <dd className="text-right font-medium tabular-nums">{money(r.value, currency)}</dd>
        </div>
      ))}
    </dl>
  );
}

function UsageBar({ usage, direct, battery }: { usage: number; direct: number; battery: number }) {
  const pct = (n: number) => (usage > 0 ? `${Math.max(0, Math.min(1, n / usage)) * 100}%` : "0%");
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-muted-foreground/20" aria-hidden>
      <div className="h-full bg-primary transition-[width] duration-500" style={{ width: pct(direct) }} />
      <div className="h-full bg-primary/50 transition-[width] duration-500" style={{ width: pct(battery) }} />
    </div>
  );
}

function Legend({
  icon: Icon,
  swatch,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  swatch: string;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", swatch)} />
      <Icon className="size-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
      <span className="tabular-nums">{value}</span>
    </li>
  );
}

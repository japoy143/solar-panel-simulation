"use client";

import { useOptimistic, useTransition } from "react";
import { ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type StatusChangeResult = { ok: true; message?: string; description?: string } | { ok: false; error: string };

/**
 * A pill-shaped status select with optimistic updates and toasts. The pill (border, colour,
 * focus ring) is on the wrapper; the native select inside has its arrow removed
 * (appearance-none) and padding reserved for our own chevron, so it never clips.
 */
export function StatusSelect<S extends string>({
  label,
  value,
  options,
  tones,
  onChange,
}: {
  /** Accessible name, e.g. "Status for Jane Doe". */
  label: string;
  value: S;
  options: { value: S; label: string }[];
  tones: Record<S, string>;
  onChange: (next: S) => Promise<StatusChangeResult>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [pending, startTransition] = useTransition();

  return (
    <span
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center rounded-full border text-xs font-medium transition-colors focus-within:ring-3 focus-within:ring-ring/50",
        tones[optimistic],
        pending && "opacity-60",
      )}
    >
      <select
        aria-label={label}
        value={optimistic}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as S;
          startTransition(async () => {
            setOptimistic(next);
            try {
              const result = await onChange(next);
              if (result.ok) {
                if (result.message) toast.success(result.message, { description: result.description });
              } else toast.error(result.error);
            } catch (err) {
              // The optimistic value reverts on its own when the transition ends.
              console.error("status change failed", err);
              toast.error("Couldn't reach the server. The status wasn't changed.");
            }
          });
        }}
        className="h-full cursor-pointer appearance-none rounded-full bg-transparent py-0 pr-8 pl-3 outline-none disabled:cursor-wait"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-background text-foreground">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-2.5 size-3.5 opacity-70" />
    </span>
  );
}

/** Read-only pill with the same look, for tables that don't edit the status. */
export function StatusPill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium", tone)}>
      {children}
    </span>
  );
}

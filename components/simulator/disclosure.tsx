"use client";

import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Toggle for a <DisclosurePanel>. */
export function DisclosureButton({
  open,
  onToggle,
  controls,
  openLabel,
  closedLabel,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  /** id of the panel it shows/hides. */
  controls: string;
  openLabel: string;
  closedLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium text-primary-strong transition-colors hover:bg-primary/5",
        className,
      )}
    >
      {open ? openLabel : closedLabel}
      <ChevronDownIcon className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
    </button>
  );
}

/**
 * Collapsible content with a height animation (grid-rows 0fr → 1fr). Closed content is `inert`,
 * so it can't be tabbed into or read out while hidden.
 */
export function DisclosurePanel({ id, open, children }: { id: string; open: boolean; children: React.ReactNode }) {
  return (
    <div
      id={id}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

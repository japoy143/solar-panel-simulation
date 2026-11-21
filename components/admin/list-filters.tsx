"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

const chipClass =
  "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted";
const activeChipClass = "border-primary/40 bg-primary/10 text-primary-strong hover:bg-primary/15";

/**
 * Search box + status chips that live in the URL (`?q=…&status=…`), so results are shareable and
 * survive reloads; the server page reads them. Reads useSearchParams, so render it inside
 * <Suspense> with <ListFiltersFallback> (required with Cache Components).
 */
export function ListFilters({ placeholder, statuses }: { placeholder: string; statuses: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("status") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  const hrefWith = (next: { q?: string; status?: string }) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const s = sp.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  // Debounced: update the URL 300 ms after typing stops.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      startTransition(() => router.replace(hrefWith({ q: q.trim() }), { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the text changes
  }, [q]);

  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-lg border bg-background pr-9 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
        />
        {pending ? (
          <LoaderCircleIcon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          )
        )}
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {[{ value: "", label: "All" }, ...statuses].map((s) => {
          const active = current === s.value;
          return (
            <Link
              key={s.value || "all"}
              href={hrefWith({ status: s.value })}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(chipClass, active && activeChipClass)}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Same layout, no interactivity: shown while the URL is read. */
export function ListFiltersFallback({ placeholder, statuses }: { placeholder: string; statuses: Option[] }) {
  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <div className="flex h-9 w-full items-center rounded-lg border pl-9 text-sm text-muted-foreground">
          {placeholder}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[{ value: "", label: "All" }, ...statuses].map((s) => (
          <span key={s.value || "all"} className={cn(chipClass, !s.value && activeChipClass)}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

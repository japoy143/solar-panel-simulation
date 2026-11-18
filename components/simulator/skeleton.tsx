export function SimulatorSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_280px]">
      <div className="order-2 hidden space-y-3 lg:order-1 lg:block">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="order-1 flex h-[60svh] min-h-[420px] items-center justify-center rounded-2xl border bg-muted lg:order-2 lg:h-[calc(100svh-14rem)] lg:min-h-[560px]">
        <p className="eyebrow text-muted-foreground">Loading 3D simulator…</p>
      </div>
      <div className="order-3 hidden space-y-3 lg:block">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LayoutGridIcon, LocateFixedIcon, Volume2Icon, VolumeOffIcon, XIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCatalog, getProduct } from "@/lib/catalog";
import { getBuilding, isBuildingId } from "@/lib/simulator/buildings";
import { resolvePlacement, type Rotation } from "@/lib/simulator/geometry";
import { playPowerUp, unlockAudioOnGesture } from "@/lib/simulator/sound";
import { summarize } from "@/lib/simulator/summary";
import { currentItems, useSimulator } from "@/lib/simulator/store";
import { BackupPower } from "./backup-power";
import { BuildingPicker, Inspector, Palette, SummaryCard } from "./panels";
import { Savings } from "./savings";
import { fillRoofWithToast, removeItemWithUndo } from "./notify";
import { ghostAt } from "./place";
import { Scene, type SceneHandle } from "./scene";
import { SimulatorSkeleton } from "./skeleton";

export default function Simulator() {
  const [ready, setReady] = useState(false);
  // Remember which item failed to rotate, so the message disappears when selection changes.
  const [rotateErrorId, setRotateErrorId] = useState<string | null>(null);
  const sceneRef = useRef<SceneHandle>(null);

  const buildingId = useSimulator((s) => s.buildingId);
  const pendingSlug = useSimulator((s) => s.pendingSlug);
  const selectedId = useSimulator((s) => s.selectedId);
  const muted = useSimulator((s) => s.muted);
  const items = useSimulator(currentItems);
  const summary = useMemo(() => summarize(items), [items]);
  const building = getBuilding(buildingId);
  const pendingProduct = pendingSlug ? getProduct(pendingSlug) : undefined;

  // Restore the saved layout, then honour ?building= from links like the home page.
  useEffect(() => {
    void Promise.resolve(useSimulator.persist.rehydrate()).then(() => {
      const param = new URLSearchParams(window.location.search).get("building");
      if (isBuildingId(param)) useSimulator.getState().setBuilding(param);
      setReady(true);
    });
  }, []);

  function rotateSelected() {
    const state = useSimulator.getState();
    const item = currentItems(state).find((it) => it.id === state.selectedId);
    const product = item && getProduct(item.slug);
    const surface = item && getBuilding(state.buildingId).surfaces.find((s) => s.id === item.surfaceId);
    if (!item || !product || !surface) return;
    const rotation: Rotation = item.rotation === 0 ? 90 : 0;
    const next = resolvePlacement({
      surface,
      product,
      rotation,
      u: item.u,
      v: item.v,
      items: currentItems(state),
      getProduct,
      ignoreId: item.id,
    });
    if (!next.valid) {
      setRotateErrorId(item.id);
      return;
    }
    setRotateErrorId(null);
    state.rotateItem(item.id, rotation, next.u, next.v);
  }

  // Celebrate the moment a layout becomes a complete, working system (not on load or building switch).
  useEffect(
    () =>
      useSimulator.subscribe((state, prev) => {
        const now = currentItems(state);
        const before = currentItems(prev);
        if (state.buildingId !== prev.buildingId || now === before) return;
        if (!summarize(now).live || summarize(before).live) return;
        if (!state.muted) playPowerUp();
        toast.success("System assembled — harvesting energy", {
          description: `${summarize(now).kwp.toFixed(1)} kWp now feeding your inverter.`,
        });
      }),
    [],
  );

  // Start audio on the first gesture so drag-and-drop placement can play sounds.
  useEffect(() => unlockAudioOnGesture(), []);

  // Keyboard shortcuts: R rotate, Delete/Backspace remove, Esc cancel/deselect.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const state = useSimulator.getState();
      if (e.key === "Escape") {
        state.setPending(null);
        state.select(null);
      } else if ((e.key === "r" || e.key === "R") && state.selectedId) {
        rotateSelected();
      } else if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId) {
        e.preventDefault();
        removeItemWithUndo(state.selectedId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // HTML5 drag from the palette onto the canvas.
  function onDragOver(e: React.DragEvent) {
    const state = useSimulator.getState();
    const product = state.pendingSlug ? getProduct(state.pendingSlug) : undefined;
    if (!product) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const hit = sceneRef.current?.pick(e.clientX, e.clientY, product.placement);
    state.setGhost(hit ? ghostAt(product.slug, hit.surface, hit.point, currentItems(state)) : null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const { ghost, addItem, setPending } = useSimulator.getState();
    if (ghost?.valid) {
      addItem({ slug: ghost.slug, surfaceId: ghost.surfaceId, u: ghost.u, v: ghost.v, rotation: ghost.rotation });
    }
    setPending(null);
  }

  const firstPanel = getCatalog().find((p) => p.category === "panel");
  const fillSlug = pendingProduct?.category === "panel" ? pendingProduct.slug : firstPanel?.slug;

  if (!ready) return <SimulatorSkeleton />;

  return (
    <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_280px]">
      <aside className="order-2 space-y-6 lg:order-1">
        <BuildingPicker />
        <Palette />
      </aside>

      <div className="order-1 lg:order-2">
        <div
          className="relative h-[60svh] min-h-[420px] overflow-hidden rounded-2xl border bg-muted lg:h-[calc(100svh-14rem)] lg:min-h-[560px]"
          onDragOver={onDragOver}
          onDragLeave={() => useSimulator.getState().setGhost(null)}
          onDrop={onDrop}
        >
          <Scene building={building} ref={sceneRef} />

          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
            <div className="pointer-events-auto rounded-lg border bg-background/90 px-3 py-2 backdrop-blur">
              <p className="eyebrow text-muted-foreground">{building.kind}</p>
              <p className="text-sm font-medium">{building.name}</p>
            </div>
            <div className="pointer-events-auto flex gap-2">
              <Button
                variant="outline"
                className="h-9 bg-background/90 backdrop-blur"
                disabled={!fillSlug}
                onClick={() => fillSlug && fillRoofWithToast(fillSlug)}
              >
                <LayoutGridIcon data-icon="inline-start" />
                Fill roof
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-9 bg-background/90 backdrop-blur"
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
                aria-pressed={!muted}
                onClick={() => useSimulator.getState().toggleMuted()}
              >
                {muted ? <VolumeOffIcon /> : <Volume2Icon />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-9 bg-background/90 backdrop-blur"
                aria-label="Reset view"
                onClick={() => sceneRef.current?.resetView()}
              >
                <LocateFixedIcon />
              </Button>
            </div>
          </div>

          {summary.live && !pendingProduct && (
            <div
              role="status"
              className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-primary/30 bg-background/90 py-1.5 pr-3 pl-2 text-sm backdrop-blur"
            >
              <span className="relative flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/50 motion-reduce:hidden" />
                <ZapIcon className="relative size-3" />
              </span>
              <span className="font-medium">Generating</span>
              <span className="font-mono text-xs text-muted-foreground">
                {summary.kwp.toFixed(1)} kWp · ~{summary.yearlyKwh.toLocaleString("en-US")} kWh/yr
              </span>
            </div>
          )}

          {pendingProduct && (
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-lg bg-foreground px-4 py-2.5 text-sm text-background">
              <span>
                Placing <strong className="font-medium">{pendingProduct.name}</strong> — tap a
                highlighted {pendingProduct.placement}.
              </span>
              <button
                type="button"
                onClick={() => useSimulator.getState().setPending(null)}
                className="flex items-center gap-1 text-background/70 hover:text-background"
              >
                <XIcon className="size-4" />
                <span className="sr-only sm:not-sr-only">Done</span>
              </button>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Drag to orbit · scroll or pinch to zoom · right-drag to pan
        </p>
        {/* Side by side under the 3D view; stacked on narrow screens. */}
        <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
          <BackupPower />
          <Savings />
        </div>
      </div>

      <aside className="order-3 space-y-4">
        <Inspector onRotate={rotateSelected} rotateError={rotateErrorId !== null && rotateErrorId === selectedId} />
        <SummaryCard />
      </aside>
    </div>
  );
}

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getProduct } from "@/lib/catalog";
import { getBuilding, type BuildingId } from "./buildings";
import { autoFill, type PlacedItem, type Rotation } from "./geometry";
import { DEFAULT_SCENARIO } from "./appliances";
import { playFill, playPlace } from "./sound";

export type Ghost = {
  slug: string;
  surfaceId: string;
  u: number;
  v: number;
  rotation: Rotation;
  valid: boolean;
};

type SimulatorState = {
  buildingId: BuildingId;
  layouts: Partial<Record<BuildingId, PlacedItem[]>>;
  selectedId: string | null;
  /** Product picked in the palette for tap-to-place (touch) or being dragged. */
  pendingSlug: string | null;
  ghost: Ghost | null;
  /** Sound effects when placing products. */
  muted: boolean;
  /** Backup-power "Together" selection: appliance id → quantity. */
  backupScenario: Record<string, number>;
  /** Bill-savings inputs; null until the visitor changes one (the detected country's preset applies). */
  savings: SavingsSettings | null;

  setBuilding: (id: BuildingId) => void;
  addItem: (item: Omit<PlacedItem, "id">) => void;
  moveItem: (id: string, u: number, v: number) => void;
  rotateItem: (id: string, rotation: Rotation, u: number, v: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  /** Fills every roof face with `slug`; returns how many panels were added. */
  fillRoof: (slug: string) => number;
  /** Puts back a saved item list for a building (used by "Undo"). */
  restoreItems: (buildingId: BuildingId, items: PlacedItem[]) => void;
  select: (id: string | null) => void;
  setPending: (slug: string | null) => void;
  setGhost: (ghost: Ghost | null) => void;
  toggleMuted: () => void;
  setApplianceQty: (id: string, qty: number) => void;
  setSavings: (settings: SavingsSettings) => void;
};

export type SavingsSettings = {
  /** ISO country code of the preset in use, or "custom" once the price/currency is typed in. */
  country: string;
  currency: string;
  /** Price per kWh in `currency`. */
  price: number;
  /** Household use per month (kWh). */
  usageKwh: number;
  /** Credit per exported kWh. */
  exportRate: number;
};

const makeId = () => Math.random().toString(36).slice(2, 10);

export const useSimulator = create<SimulatorState>()(
  persist(
    (set, get) => {
      const updateItems = (fn: (items: PlacedItem[]) => PlacedItem[]) =>
        set((s) => ({
          layouts: { ...s.layouts, [s.buildingId]: fn(s.layouts[s.buildingId] ?? []) },
        }));

      return {
        buildingId: "small-house",
        layouts: {},
        selectedId: null,
        pendingSlug: null,
        ghost: null,
        muted: false,
        backupScenario: DEFAULT_SCENARIO,
        savings: null,

        setBuilding: (buildingId) => set({ buildingId, selectedId: null, ghost: null }),
        addItem: (item) => {
          const id = makeId();
          updateItems((items) => [...items, { ...item, id }]);
          set({ selectedId: id });
          const category = getProduct(item.slug)?.category;
          if (category && !get().muted) playPlace(category);
        },
        moveItem: (id, u, v) =>
          updateItems((items) => items.map((it) => (it.id === id ? { ...it, u, v } : it))),
        rotateItem: (id, rotation, u, v) =>
          updateItems((items) => items.map((it) => (it.id === id ? { ...it, rotation, u, v } : it))),
        removeItem: (id) => {
          updateItems((items) => items.filter((it) => it.id !== id));
          if (get().selectedId === id) set({ selectedId: null });
        },
        clear: () => {
          updateItems(() => []);
          set({ selectedId: null });
        },
        fillRoof: (slug) => {
          const product = getProduct(slug);
          if (!product || product.placement !== "roof") return 0;
          const building = getBuilding(get().buildingId);
          const before = currentItems(get()).length;
          updateItems((items) => {
            let next = items;
            for (const surface of building.surfaces.filter((s) => s.kind === "roof")) {
              // Use whichever orientation fits more panels on this face.
              const [portrait, landscape] = ([0, 90] as const).map((rotation) =>
                autoFill({ surface, product, rotation, items: next, getProduct, makeId }),
              );
              next = [...next, ...(landscape.length > portrait.length ? landscape : portrait)];
            }
            return next;
          });
          const added = currentItems(get()).length - before;
          if (added > 0 && !get().muted) playFill();
          return added;
        },
        restoreItems: (buildingId, items) => set((s) => ({ layouts: { ...s.layouts, [buildingId]: items } })),
        select: (selectedId) => set({ selectedId }),
        setPending: (pendingSlug) => set({ pendingSlug, ghost: null }),
        setGhost: (ghost) => set({ ghost }),
        toggleMuted: () => set((s) => ({ muted: !s.muted })),
        setSavings: (savings) => set({ savings }),
        setApplianceQty: (id, qty) =>
          set((s) => {
            const next = { ...s.backupScenario };
            if (qty > 0) next[id] = Math.min(qty, 9);
            else delete next[id];
            return { backupScenario: next };
          }),
      };
    },
    {
      name: "solar-layout:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        buildingId: s.buildingId,
        layouts: s.layouts,
        muted: s.muted,
        backupScenario: s.backupScenario,
        savings: s.savings,
      }),
      // Rehydrate manually after mount so server and first client render match.
      skipHydration: true,
    },
  ),
);

const EMPTY: PlacedItem[] = [];
export const currentItems = (s: SimulatorState) => s.layouts[s.buildingId] ?? EMPTY;

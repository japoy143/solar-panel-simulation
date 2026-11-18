"use client";

import { toast } from "sonner";
import { getProduct } from "@/lib/catalog";
import { getBuilding } from "@/lib/simulator/buildings";
import { currentItems, useSimulator } from "@/lib/simulator/store";

/** Snapshot the current building's layout and return an Undo toast action that restores it. */
function undoAction() {
  const state = useSimulator.getState();
  const buildingId = state.buildingId;
  const snapshot = currentItems(state);
  return {
    label: "Undo",
    onClick: () => {
      useSimulator.getState().restoreItems(buildingId, snapshot);
      toast.success("Restored");
    },
  };
}

export function removeItemWithUndo(id: string) {
  const state = useSimulator.getState();
  const item = currentItems(state).find((it) => it.id === id);
  if (!item) return;
  const action = undoAction();
  state.removeItem(id);
  toast(`${getProduct(item.slug)?.name ?? "Item"} removed`, { action });
}

export function clearLayoutWithUndo() {
  const state = useSimulator.getState();
  const count = currentItems(state).length;
  const action = undoAction();
  state.clear();
  toast.success("Layout cleared", {
    description: `Removed ${count} item${count === 1 ? "" : "s"} from the ${getBuilding(state.buildingId).name.toLowerCase()}.`,
    action,
  });
}

export function fillRoofWithToast(slug: string) {
  const action = undoAction();
  const added = useSimulator.getState().fillRoof(slug);
  const name = getProduct(slug)?.name ?? "panels";
  if (added > 0) {
    toast.success(`Added ${added} panel${added === 1 ? "" : "s"}`, { description: name, action });
  } else {
    toast.info("The roof is already full", { description: `No space left for another ${name}.` });
  }
}

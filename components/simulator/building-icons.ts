import {
  Building2Icon,
  CastleIcon,
  HouseIcon,
  HousePlusIcon,
  HousesIcon,
  LandPlotIcon,
  TentIcon,
  TreePineIcon,
  WarehouseIcon,
  type LucideIcon,
} from "lucide-react";
import type { BuildingId } from "@/lib/simulator/buildings";

/** One icon per building, shared by the home page and the simulator picker. */
export const buildingIcons: Record<BuildingId, LucideIcon> = {
  "small-house": HouseIcon,
  "medium-house": HousePlusIcon,
  "large-house": HousesIcon,
  "modern-cabin": TentIcon,
  "modern-bungalow": TreePineIcon,
  "modern-split": LandPlotIcon,
  "modern-two-storey": WarehouseIcon,
  "modern-villa": CastleIcon,
  commercial: Building2Icon,
};

import "server-only";
import { z } from "zod";
import { getProducts } from "@/lib/data/products";
import { searchFilter } from "@/lib/data/search";
import { getBuilding, isBuildingId, type BuildingId } from "@/lib/simulator/buildings";
import type { PlacedItem } from "@/lib/simulator/geometry";
import { moduleLogger } from "@/lib/server/logger";
import { createClient } from "@/lib/supabase/server";

const log = moduleLogger("data.bookings");

export const bookingStatuses = ["new", "confirmed", "completed", "cancelled"] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

export type Booking = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string | null;
  preferredDate: string;
  address: string;
  notes: string | null;
  status: BookingStatus;
  /** Short description of the attached simulator layout, if any. */
  layoutSummary: string | null;
  clientId: string | null;
  /** When the admin first opened it (null: never). */
  seenAt: string | null;
};

type Row = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  preferred_date: string;
  address: string;
  notes: string | null;
  status: BookingStatus;
  layout: BookingLayout | null;
  client_id: string | null;
  seen_at: string | null;
};

/** The simulator layout attached to a booking (see LayoutSummaryField). */
export type BookingLayout = {
  building?: string;
  summary?: { panels?: number; kwp?: number; batteryKwh?: number };
};

/** "Medium house · 14 panels · 5.7 kWp · 10 kWh battery", or null without a usable layout. */
export function describeLayout(layout: BookingLayout | null | undefined) {
  const s = layout?.summary;
  if (!s || !s.panels) return null;
  const parts = [`${s.panels} panels`, `${(Number(s.kwp) || 0).toFixed(1)} kWp`];
  if (layout?.building && isBuildingId(layout.building)) parts.unshift(getBuilding(layout.building).name);
  if (s.batteryKwh) parts.push(`${s.batteryKwh} kWh battery`);
  return parts.join(" · ");
}

const toBooking = (r: Row): Booking => ({
  id: r.id,
  createdAt: r.created_at,
  name: r.name,
  email: r.email,
  phone: r.phone,
  preferredDate: r.preferred_date,
  address: r.address,
  notes: r.notes,
  status: r.status,
  layoutSummary: describeLayout(r.layout),
  clientId: r.client_id,
  seenAt: r.seen_at,
});

/** Newest first, optionally searched and filtered. Admin only: RLS returns nothing to anyone else. */
export async function getBookings({
  q,
  status,
  limit = 200,
}: { q?: string; status?: BookingStatus; limit?: number } = {}): Promise<Booking[]> {
  const supabase = await createClient();
  let query = supabase.from("bookings").select("*");
  const search = searchFilter(q, ["name", "email", "phone", "address"]);
  if (search) query = query.or(search);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) {
    log.error({ code: error.code, msg: error.message }, "bookings query failed");
    throw new Error(`Couldn't load bookings: ${error.message}`);
  }
  return (data as Row[]).map(toBooking);
}

/** Everything the simulator attached, for the booking detail page. */
export type BookingLayoutDetail = {
  buildingId: BuildingId | null;
  buildingName: string | null;
  /** The placed items, validated against the building's surfaces; drives the 3D preview. */
  items: PlacedItem[];
  panels: number;
  kwp: number;
  yearlyKwh: number | null;
  inverterKw: number | null;
  batteryKwh: number | null;
  backupLimitKw: number | null;
  products: { name: string; count: number }[];
  warnings: string[];
};

export type BookingDetail = Booking & { layout: BookingLayoutDetail | null };

// The layout JSON is written by guests, so parse it defensively: drop anything malformed
// instead of failing the page.
const optionalNumber = z.number().finite().nonnegative().nullish().catch(null);
const layoutSchema = z
  .object({
    building: z.string().nullish().catch(null),
    summary: z
      .object({
        panels: z.number().int().nonnegative().catch(0),
        kwp: z.number().finite().nonnegative().catch(0),
        yearlyKwh: optionalNumber,
        inverterKw: optionalNumber,
        batteryKwh: optionalNumber,
        backupLimitKw: optionalNumber,
        products: z
          .array(z.object({ name: z.string().max(200), count: z.number().int().positive() }))
          .max(50)
          .catch([]),
        warnings: z.array(z.string().max(300)).max(20).catch([]),
      })
      .nullish()
      .catch(null),
    // Validated one by one below, so a single bad item doesn't discard the whole layout.
    items: z.array(z.unknown()).max(1000).nullish().catch(null),
  })
  .nullish()
  .catch(null);

const itemSchema = z.object({
  id: z.string().max(100),
  slug: z.string().max(200),
  surfaceId: z.string().max(100),
  u: z.number().finite(),
  v: z.number().finite(),
  rotation: z.union([z.literal(0), z.literal(90)]),
});

function toLayoutDetail(raw: unknown): BookingLayoutDetail | null {
  const parsed = layoutSchema.parse(raw);
  const s = parsed?.summary;
  if (!s || (s.panels === 0 && s.products.length === 0)) return null;
  const buildingId = parsed.building && isBuildingId(parsed.building) ? parsed.building : null;
  const surfaces = new Set(buildingId ? getBuilding(buildingId).surfaces.map((x) => x.id) : []);
  const items = (parsed.items ?? []).flatMap((raw) => {
    const item = itemSchema.safeParse(raw);
    return item.success && surfaces.has(item.data.surfaceId) ? [item.data] : [];
  });
  return {
    buildingId,
    buildingName: buildingId ? getBuilding(buildingId).name : null,
    items,
    panels: s.panels,
    kwp: s.kwp,
    yearlyKwh: s.yearlyKwh ?? null,
    inverterKw: s.inverterKw || null,
    batteryKwh: s.batteryKwh || null,
    backupLimitKw: s.backupLimitKw ?? null,
    products: s.products,
    warnings: s.warnings,
  };
}

/** One booking with its full layout, or null if it doesn't exist. Admin only (RLS). */
export async function getBooking(id: string): Promise<BookingDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) {
    log.error({ bookingId: id, code: error.code, msg: error.message }, "booking query failed");
    throw new Error(`Couldn't load booking: ${error.message}`);
  }
  if (!data) return null;
  const row = data as Row;
  return { ...toBooking(row), layout: toLayoutDetail(row.layout) };
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const count = { count: "exact", head: true } as const;
  const [month, pending, unread, activeProducts] = await Promise.all([
    supabase.from("bookings").select("id", count).gte("created_at", monthStart.toISOString()),
    supabase.from("bookings").select("id", count).eq("status", "new"),
    supabase.from("messages").select("id", count).eq("direction", "inbound").is("read_at", null),
    // The public catalog is exactly the active products, and it's cached (tagged PRODUCTS_TAG,
    // refreshed by every product action), so the count usually costs no query at all.
    getProducts().then(
      (products) => products.length,
      (err: unknown) => {
        log.error({ stat: "products", err }, "dashboard stat query failed");
        return 0;
      },
    ),
  ]);
  // Figures are non-critical: show 0 rather than failing the whole dashboard, but log it.
  for (const [name, res] of Object.entries({ month, pending, unread })) {
    if (res.error) log.error({ stat: name, code: res.error.code, msg: res.error.message }, "dashboard stat query failed");
  }
  return {
    bookingsThisMonth: month.count ?? 0,
    pending: pending.count ?? 0,
    unreadMessages: unread.count ?? 0,
    activeProducts,
  };
}

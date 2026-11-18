import "server-only";
import { getBuilding, isBuildingId } from "@/lib/simulator/buildings";
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
});

/** Admin only: RLS returns nothing to anyone else. */
export async function getBookings(limit = 200): Promise<Booking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    log.error({ code: error.code, msg: error.message }, "bookings query failed");
    throw new Error(`Couldn't load bookings: ${error.message}`);
  }
  return (data as Row[]).map(toBooking);
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const count = { count: "exact", head: true } as const;
  const [month, pending, products] = await Promise.all([
    supabase.from("bookings").select("id", count).gte("created_at", monthStart.toISOString()),
    supabase.from("bookings").select("id", count).eq("status", "new"),
    supabase.from("products").select("id", count).eq("active", true),
  ]);
  // Figures are non-critical: show 0 rather than failing the whole dashboard, but log it.
  for (const [name, res] of Object.entries({ month, pending, products })) {
    if (res.error) log.error({ stat: name, code: res.error.code, msg: res.error.message }, "dashboard stat query failed");
  }
  return {
    bookingsThisMonth: month.count ?? 0,
    pending: pending.count ?? 0,
    activeProducts: products.count ?? 0,
  };
}

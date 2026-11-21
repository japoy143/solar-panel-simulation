import "server-only";
import type { ClientStatus } from "@/lib/clients";
import type { BookingStatus } from "@/lib/data/bookings";
import { searchFilter } from "@/lib/data/search";
import { moduleLogger } from "@/lib/server/logger";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isServiceConfigured } from "@/lib/supabase/service";

const log = moduleLogger("data.clients");

export type ClientSummary = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
  bookingCount: number;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type ClientDetail = ClientSummary & {
  bookings: { id: string; createdAt: string; preferredDate: string; address: string; status: BookingStatus }[];
};

type OverviewRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
  booking_count: number;
  last_message_at: string | null;
  unread_count: number;
};

const toClient = (r: OverviewRow): ClientSummary => ({
  id: r.id,
  createdAt: r.created_at,
  name: r.name,
  email: r.email,
  phone: r.phone,
  address: r.address,
  status: r.status,
  bookingCount: Number(r.booking_count) || 0,
  lastMessageAt: r.last_message_at,
  unreadCount: Number(r.unread_count) || 0,
});

/** Clients, most recent activity first, optionally searched and filtered. Admin only (RLS). */
export async function getClients({
  q,
  status,
  limit = 200,
}: { q?: string; status?: ClientStatus; limit?: number } = {}): Promise<ClientSummary[]> {
  const supabase = await createClient();
  let query = supabase.from("client_overview").select("*");
  const search = searchFilter(q, ["name", "email", "phone", "address"]);
  if (search) query = query.or(search);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("last_activity_at", { ascending: false }).limit(limit);
  if (error) {
    log.error({ code: error.code, msg: error.message }, "clients query failed");
    throw new Error(`Couldn't load clients: ${error.message}`);
  }
  return (data as OverviewRow[]).map(toClient);
}

/** One client with their bookings, or null. Admin only (RLS). */
export async function getClient(id: string): Promise<ClientDetail | null> {
  const supabase = await createClient();
  const [client, bookings] = await Promise.all([
    supabase.from("client_overview").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, created_at, preferred_date, address, status")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const error = client.error ?? bookings.error;
  if (error) {
    log.error({ clientId: id, code: error.code, msg: error.message }, "client query failed");
    throw new Error(`Couldn't load client: ${error.message}`);
  }
  if (!client.data) return null;
  return {
    ...toClient(client.data as OverviewRow),
    bookings: (
      bookings.data as { id: string; created_at: string; preferred_date: string; address: string; status: BookingStatus }[]
    ).map((b) => ({
      id: b.id,
      createdAt: b.created_at,
      preferredDate: b.preferred_date,
      address: b.address,
      status: b.status,
    })),
  };
}

/**
 * The client a booking was linked to by the database trigger. Used by the guest booking flow
 * (no admin session), so it needs the service client; returns null when that isn't configured.
 */
export async function getBookingClientId(bookingId: string): Promise<string | null> {
  if (!isServiceConfigured) return null;
  try {
    const { data, error } = await createServiceClient()
      .from("bookings")
      .select("client_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (error) log.warn({ bookingId, msg: error.message }, "couldn't look up booking client");
    return (data?.client_id as string | null) ?? null;
  } catch (err) {
    log.warn({ err, bookingId }, "couldn't look up booking client");
    return null;
  }
}

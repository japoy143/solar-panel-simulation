"use server";

import { requireAdmin } from "@/lib/auth";
import { bookingStatuses, type BookingStatus } from "@/lib/data/bookings";
import { createClient } from "@/lib/supabase/server";

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  if (!bookingStatuses.includes(status)) return { ok: false, error: "Unknown status." };
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't update the booking." };
  return { ok: true };
}

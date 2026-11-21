"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { bookingStatuses, describeLayout, type BookingLayout, type BookingStatus } from "@/lib/data/bookings";
import { isEmailConfigured, sendBookingConfirmed } from "@/lib/email";
import { runAction, unexpected } from "@/lib/server/action";
import { maskEmail } from "@/lib/server/logger";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; emailed: boolean } | { ok: false; error: string };

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Result> {
  return runAction<Result>(
    "updateBookingStatus",
    async ({ log, ref }) => {
      await requireAdmin();
      if (!z.uuid().safeParse(id).success) return { ok: false, error: "That booking doesn't exist." };
      if (!bookingStatuses.includes(status)) {
        log.warn({ bookingId: id, status }, "rejected: unknown status");
        return { ok: false, error: "Unknown status." };
      }
      const supabase = await createClient();

      const { data: before, error: readError } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", id)
        .maybeSingle();
      if (readError) {
        log.error({ bookingId: id, code: readError.code, msg: readError.message }, "couldn't read booking");
        return { ok: false, error: `Couldn't update the booking. (Reference: ${ref})` };
      }
      if (!before) return { ok: false, error: "That booking no longer exists." };

      const { data: row, error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id)
        .select("name, email, phone, preferred_date, address, notes, layout, client_id")
        .single();
      if (error || !row) {
        log.error({ bookingId: id, status, code: error?.code, msg: error?.message }, "booking status update failed");
        return { ok: false, error: `Couldn't update the booking. (Reference: ${ref})` };
      }
      log.info({ bookingId: id, from: before.status, to: status }, "booking status changed");
      // Re-render the admin pages with the new status. Without this the select's optimistic value
      // falls back to the stale `status` prop when the transition ends, and the dashboard's
      // "Pending requests" figure stays out of date in the client router cache.
      refresh();

      // Email the customer only when the booking newly becomes confirmed (not on every re-save).
      const emailed = status === "confirmed" && before.status !== "confirmed";
      if (emailed) {
        after(async () => {
          try {
            await sendBookingConfirmed({
              name: row.name,
              email: row.email,
              phone: row.phone,
              preferredDate: row.preferred_date,
              address: row.address,
              notes: row.notes,
              layoutSummary: describeLayout(row.layout as BookingLayout | null),
              clientId: row.client_id as string | null,
              bookingId: id,
            }, supabase);
          } catch (err) {
            log.error({ err, bookingId: id, customer: maskEmail(row.email) }, "confirmation email failed");
          }
        });
      }
      // Only claim an email went out when sending is configured (otherwise it is skipped).
      return { ok: true, emailed: emailed && isEmailConfigured };
    },
    (ref) => ({ ok: false, error: unexpected(ref) }),
  );
}

/** Opening a booking marks it as seen, so it leaves the notification bell. */
export async function markBookingSeen(id: string): Promise<void> {
  await runAction(
    "markBookingSeen",
    async ({ log }) => {
      await requireAdmin();
      if (!z.uuid().safeParse(id).success) return;
      const supabase = await createClient();
      const { error } = await supabase
        .from("bookings")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", id)
        .is("seen_at", null);
      if (error) log.warn({ bookingId: id, msg: error.message }, "couldn't mark booking seen");
    },
    () => undefined,
  );
}

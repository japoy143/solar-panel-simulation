"use server";

import { after } from "next/server";
import { describeLayout, type BookingLayout } from "@/lib/data/bookings";
import { HONEYPOT_FIELD } from "@/lib/booking-form";
import { getBookingClientId } from "@/lib/data/clients";
import { sendBookingReceived } from "@/lib/email";
import { runAction, unexpected } from "@/lib/server/action";
import { maskEmail } from "@/lib/server/logger";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

export type BookingState =
  | { status: "idle" }
  | { status: "success"; message: string; submittedAt: number }
  | { status: "error"; message: string; fieldErrors: Partial<Record<BookingField, string>>; submittedAt: number };

type BookingField = "name" | "email" | "date" | "address";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One-line fields (they end up in email subjects): no newlines or other control characters. */
const singleLine = (s: string) => s.replace(/\p{Cc}+/gu, " ").trim();
/** Multi-line text keeps line breaks and tabs, but no other control characters (incl. `\r`). */
const multiLine = (s: string) => s.replace(/(?![\n\t])\p{Cc}/gu, "").trim();

/** A real YYYY-MM-DD date (rejects "2026-02-31", which Postgres would refuse on insert). */
function isCalendarDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * "Today" in the westernmost time zone (UTC−12), as YYYY-MM-DD. The form sends the visitor's
 * local date, so comparing with the server's UTC date would reject "today" for anyone west of
 * UTC once it's past midnight UTC (e.g. evenings in the Americas).
 */
const earliestToday = () => new Date(Date.now() - 12 * 3_600_000).toISOString().slice(0, 10);

const failed = (message: string): BookingState => ({
  status: "error",
  message,
  fieldErrors: {},
  submittedAt: Date.now(),
});

export async function createBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  return runAction(
    "createBooking",
    async ({ log, ref }) => {
      const raw = (key: string) => {
        const value = formData.get(key);
        return typeof value === "string" ? value : "";
      };
      const text = (key: string) => singleLine(raw(key));
      const fieldErrors: Partial<Record<BookingField, string>> = {};

      if (!text("name")) fieldErrors.name = "Enter your name.";
      if (!EMAIL.test(text("email")) || text("email").length > 254) fieldErrors.email = "Enter a valid email address.";
      if (!text("address")) fieldErrors.address = "Enter the installation address.";
      const date = text("date");
      if (!date) fieldErrors.date = "Pick a preferred date.";
      else if (!isCalendarDate(date)) fieldErrors.date = "Pick a valid date.";
      else if (date < earliestToday()) fieldErrors.date = "Pick a date from today onwards.";

      if (Object.keys(fieldErrors).length > 0) {
        // Field names only: never log what the customer typed.
        log.info({ invalidFields: Object.keys(fieldErrors) }, "booking rejected: validation");
        return {
          status: "error",
          message: "Please check the highlighted fields.",
          fieldErrors,
          submittedAt: Date.now(),
        };
      }

      // A bot filled the hidden field: answer as if it worked so it doesn't adapt, but save and
      // email nothing (otherwise the form could be used to send our emails to any address).
      if (raw(HONEYPOT_FIELD)) {
        log.info("booking dropped: honeypot field filled");
        return { status: "success", message: "Thanks! We'll email you to confirm your visit.", submittedAt: Date.now() };
      }

      if (!isSupabaseConfigured) {
        log.error("booking rejected: Supabase is not configured");
        return failed("Bookings are temporarily unavailable. Please try again later.");
      }

      // Optional simulator layout (JSON: { building, items, summary }) from LayoutSummaryField.
      let layout: unknown = null;
      const rawLayout = formData.get("layout");
      if (typeof rawLayout === "string" && rawLayout.length > 0) {
        if (rawLayout.length >= 200_000) {
          log.warn({ bytes: rawLayout.length }, "layout too large; booking saved without it");
        } else {
          try {
            layout = JSON.parse(rawLayout);
          } catch (err) {
            log.warn({ err }, "layout JSON invalid; booking saved without it"); // never block the booking
          }
        }
      }

      // Generated here because guests may insert but not read bookings (no insert…select):
      // the id lets the email step find the client the database trigger linked it to.
      const booking = {
        id: crypto.randomUUID(),
        name: text("name").slice(0, 200),
        email: text("email").slice(0, 320),
        phone: text("phone").slice(0, 50) || null,
        preferred_date: date,
        address: text("address").slice(0, 500),
        notes: multiLine(raw("notes")).slice(0, 5000) || null,
        layout,
      };

      // Guest client: Row Level Security only allows inserting new bookings, never reading them.
      const { error } = await createPublicClient().from("bookings").insert(booking);
      if (error) {
        // No `details`: for constraint violations Postgres puts the whole failing row (customer PII) there.
        log.error({ code: error.code, hint: error.hint, msg: error.message }, "booking insert failed");
        return failed(`We couldn't save your request. Please try again. (Reference: ${ref})`);
      }
      log.info(
        { customer: maskEmail(booking.email), date: booking.preferred_date, withLayout: layout != null },
        "booking created",
      );

      // Emails go out after the response, so the customer isn't kept waiting and an email
      // problem can't turn a saved booking into an error.
      after(async () => {
        try {
          const clientId = await getBookingClientId(booking.id);
          await sendBookingReceived({
            name: booking.name,
            email: booking.email,
            phone: booking.phone,
            preferredDate: booking.preferred_date,
            address: booking.address,
            notes: booking.notes,
            layoutSummary: describeLayout(layout as BookingLayout | null),
            clientId,
            bookingId: booking.id,
          });
        } catch (err) {
          log.error({ err }, "booking emails failed");
        }
      });

      return {
        status: "success",
        message: `Thanks, ${booking.name.split(" ")[0]}! We'll email ${booking.email} to confirm your visit.`,
        submittedAt: Date.now(),
      };
    },
    (ref) => failed(unexpected(ref)),
  );
}

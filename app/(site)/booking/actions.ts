"use server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

export type BookingState =
  | { status: "idle" }
  | { status: "success"; message: string; submittedAt: number }
  | { status: "error"; message: string; fieldErrors: Partial<Record<BookingField, string>>; submittedAt: number };

type BookingField = "name" | "email" | "date" | "address";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const fieldErrors: Partial<Record<BookingField, string>> = {};

  if (!text("name")) fieldErrors.name = "Enter your name.";
  if (!EMAIL.test(text("email"))) fieldErrors.email = "Enter a valid email address.";
  if (!text("address")) fieldErrors.address = "Enter the installation address.";
  const date = text("date");
  const today = new Date().toISOString().slice(0, 10);
  if (!date) fieldErrors.date = "Pick a preferred date.";
  else if (date < today) fieldErrors.date = "Pick a date from today onwards.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
      submittedAt: Date.now(),
    };
  }

  const failed = (message: string): BookingState => ({
    status: "error",
    message,
    fieldErrors: {},
    submittedAt: Date.now(),
  });
  if (!isSupabaseConfigured) return failed("Bookings are temporarily unavailable. Please try again later.");

  // Optional simulator layout (JSON: { building, items, summary }) from LayoutSummaryField.
  let layout: unknown = null;
  const rawLayout = formData.get("layout");
  if (typeof rawLayout === "string" && rawLayout.length > 0 && rawLayout.length < 200_000) {
    try {
      layout = JSON.parse(rawLayout);
    } catch {
      layout = null; // a bad layout shouldn't block the booking
    }
  }

  // Guest client: Row Level Security only allows inserting new bookings, never reading them.
  const { error } = await createPublicClient()
    .from("bookings")
    .insert({
      name: text("name").slice(0, 200),
      email: text("email").slice(0, 320),
      phone: text("phone").slice(0, 50) || null,
      preferred_date: date,
      address: text("address").slice(0, 500),
      notes: text("notes").slice(0, 5000) || null,
      layout,
    });
  if (error) {
    console.error("[booking] insert failed:", error.message);
    return failed("Something went wrong saving your request. Please try again.");
  }
  // TODO: send the confirmation email.

  return {
    status: "success",
    message: `Thanks, ${text("name").split(" ")[0]}! We'll email ${text("email")} to confirm your visit.`,
    submittedAt: Date.now(),
  };
}

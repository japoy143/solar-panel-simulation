"use client";

import { updateBookingStatus } from "@/app/admin/(dashboard)/bookings/actions";
import { bookingStatusLabels, bookingStatusList, type BookingStatusValue } from "@/lib/clients";
import { StatusSelect } from "./status-select";

export const bookingStatusTones: Record<BookingStatusValue, string> = {
  new: "border-primary/40 bg-primary/10 text-primary-strong",
  confirmed: "border-foreground/20 bg-background",
  completed: "border-transparent bg-muted text-muted-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

const options = bookingStatusList.map((s) => ({ value: s, label: bookingStatusLabels[s] }));

export function BookingStatusSelect({ id, name, status }: { id: string; name: string; status: BookingStatusValue }) {
  return (
    <StatusSelect
      label={`Status for ${name}`}
      value={status}
      options={options}
      tones={bookingStatusTones}
      onChange={async (next) => {
        const result = await updateBookingStatus(id, next);
        if (!result.ok) return result;
        return {
          ok: true,
          message: `${name}: ${bookingStatusLabels[next].toLowerCase()}`,
          description: result.emailed ? "Confirmation email sent to the customer." : undefined,
        };
      }}
    />
  );
}

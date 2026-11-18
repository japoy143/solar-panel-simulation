"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { updateBookingStatus } from "@/app/admin/(dashboard)/bookings/actions";
import { cn } from "@/lib/utils";

const statuses = ["new", "confirmed", "completed", "cancelled"] as const;
type Status = (typeof statuses)[number];

const labels: Record<Status, string> = {
  new: "New",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const tone: Record<Status, string> = {
  new: "border-primary/40 bg-primary/10 text-primary-strong",
  confirmed: "border-foreground/20 bg-background",
  completed: "border-transparent bg-muted text-muted-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function BookingStatusSelect({ id, name, status }: { id: string; name: string; status: Status }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label={`Status for ${name}`}
      value={optimistic}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Status;
        startTransition(async () => {
          setOptimistic(next);
          try {
            const result = await updateBookingStatus(id, next);
            if (result.ok)
              toast.success(`${name}: ${labels[next].toLowerCase()}`, {
                description: result.emailed ? "Confirmation email sent to the customer." : undefined,
              });
            else toast.error(result.error);
          } catch (err) {
            // The optimistic value reverts on its own when the transition ends.
            console.error("updateBookingStatus failed", err);
            toast.error("Couldn't reach the server. The status wasn't changed.");
          }
        });
      }}
      className={cn(
        "h-8 rounded-full border px-2.5 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        tone[optimistic],
      )}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {labels[s]}
        </option>
      ))}
    </select>
  );
}

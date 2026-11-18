"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { createBooking, type BookingState } from "@/app/(site)/booking/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LayoutSummaryField } from "@/components/site/layout-summary-field";

const initial: BookingState = { status: "idle" };

export function BookingForm() {
  const [state, action, pending] = useActionState(createBooking, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.status === "error" ? state.fieldErrors : {};

  // One toast per submission (submittedAt changes every time, even for the same message).
  const submittedAt = state.status === "idle" ? 0 : state.submittedAt;
  useEffect(() => {
    if (state.status === "success") {
      toast.success("Booking requested", { description: state.message });
      formRef.current?.reset();
    } else if (state.status === "error") {
      toast.error("Couldn't send your booking", { description: state.message });
      formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per submission
  }, [submittedAt]);

  const field = (name: keyof typeof errors) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  const error = (name: keyof typeof errors) =>
    errors[name] && (
      <p id={`${name}-error`} className="text-xs text-destructive">
        {errors[name]}
      </p>
    );

  return (
    <form
      ref={formRef}
      noValidate
      // Submit manually: a form `action` is auto-reset by React, which would wipe the
      // user's input on validation errors. We reset ourselves on success instead.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-5 sm:grid-cols-2"
    >
      <div className="grid gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input className="h-10" id="name" name="name" autoComplete="name" required {...field("name")} />
        {error("name")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input className="h-10" id="email" name="email" type="email" autoComplete="email" required {...field("email")} />
        {error("email")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input className="h-10" id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="date">Preferred date</Label>
        <Input className="h-10" id="date" name="date" type="date" required {...field("date")} />
        {error("date")}
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="address">Installation address</Label>
        <Input className="h-10" id="address" name="address" autoComplete="street-address" required {...field("address")} />
        {error("address")}
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={4} placeholder="Roof type, shading, anything we should know" />
      </div>
      <LayoutSummaryField />
      <div className="sm:col-span-2">
        <Button type="submit" className="h-10 w-full px-5 sm:w-auto" disabled={pending}>
          {pending && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
          {pending ? "Sending…" : "Request booking"}
        </Button>
      </div>
    </form>
  );
}

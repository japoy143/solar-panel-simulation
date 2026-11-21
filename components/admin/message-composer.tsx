"use client";

import { useActionState, useEffect, useState } from "react";
import { LoaderCircleIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { sendClientEmail, type SendMessageState } from "@/app/admin/(dashboard)/clients/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

/** Writes an email to the client; it's sent with Resend and appended to the thread. */
export function MessageComposer({
  clientId,
  clientName,
  defaultSubject,
  disabled = false,
  hint = "Sent by email. Their reply will appear in this conversation.",
}: {
  clientId: string;
  clientName: string;
  defaultSubject: string;
  /** Email isn't configured: the form can't send. */
  disabled?: boolean;
  /** Line next to the Send button (explains how replies come back, or why sending is off). */
  hint?: string;
}) {
  const [state, action, pending] = useActionState<SendMessageState, FormData>(
    sendClientEmail.bind(null, clientId),
    { status: "idle" },
  );
  // Controlled, so a failed send never wipes what was typed (React resets uncontrolled forms).
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [handledAt, setHandledAt] = useState(0);

  // React to each new result once: toast, and clear the message after a successful send.
  if (state.status !== "idle" && state.at !== handledAt) {
    setHandledAt(state.at);
    if (state.status === "success") setBody("");
  }
  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    else if (state.status === "error") toast.error(state.message);
  }, [state]);

  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={action} className="space-y-3 border-t p-4">
      <div>
        <label htmlFor="message-subject" className="sr-only">
          Subject
        </label>
        <input
          id="message-subject"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          maxLength={200}
          aria-invalid={Boolean(errors.subject) || undefined}
          className={cn(fieldClass, "h-9")}
        />
        {errors.subject && <p className="mt-1 text-xs text-destructive">{errors.subject}</p>}
      </div>
      <div>
        <label htmlFor="message-body" className="sr-only">
          Message
        </label>
        <textarea
          id="message-body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // ⌘/Ctrl + Enter sends, like most messaging apps.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
          placeholder={`Write to ${clientName}…`}
          rows={4}
          aria-invalid={Boolean(errors.body) || undefined}
          className={cn(fieldClass, "resize-y py-2")}
        />
        {errors.body && <p className="mt-1 text-xs text-destructive">{errors.body}</p>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {hint}
        </p>
        <Button type="submit" disabled={pending || disabled} className="h-9 shrink-0 px-4">
          {pending ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
          Send
        </Button>
      </div>
    </form>
  );
}

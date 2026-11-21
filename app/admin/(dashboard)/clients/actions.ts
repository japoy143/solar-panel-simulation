"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { clientStatuses, type ClientStatus } from "@/lib/clients";
import { recordMessage } from "@/lib/data/messages";
import { isEmailConfigured, sendClientMessage } from "@/lib/email";
import { runAction, unexpected } from "@/lib/server/action";
import { maskEmail } from "@/lib/server/logger";
import { createClient } from "@/lib/supabase/server";

const UUID = z.uuid();

export type SendMessageState =
  | { status: "idle" }
  | { status: "success"; message: string; at: number }
  | { status: "error"; message: string; fieldErrors: Partial<Record<"subject" | "body", string>>; at: number };

const messageSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject.").max(200, "Keep the subject under 200 characters."),
  body: z.string().trim().min(1, "Write a message.").max(20_000, "That message is too long."),
});

/** Emails the client from their conversation and records it in the thread. */
export async function sendClientEmail(
  clientId: string,
  _prev: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const at = Date.now();
  const fail = (message: string): SendMessageState => ({ status: "error", message, fieldErrors: {}, at });
  return runAction<SendMessageState>(
    "sendClientEmail",
    async ({ log, ref }) => {
      await requireAdmin();
      if (!UUID.safeParse(clientId).success) return fail("That client doesn't exist.");

      const parsed = messageSchema.safeParse({ subject: formData.get("subject"), body: formData.get("body") });
      if (!parsed.success) {
        const fieldErrors: Partial<Record<"subject" | "body", string>> = {};
        for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as "subject" | "body"] ??= issue.message;
        return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, at };
      }
      if (!isEmailConfigured) return fail("Email isn't set up yet (RESEND_API_KEY). See the README.");

      const supabase = await createClient();
      const { data: client, error } = await supabase
        .from("clients")
        .select("id, name, email")
        .eq("id", clientId)
        .maybeSingle();
      if (error) {
        log.error({ clientId, code: error.code, msg: error.message }, "couldn't load client");
        return fail(`Couldn't send the message. (Reference: ${ref})`);
      }
      if (!client) return fail("That client no longer exists.");

      const { subject, body } = parsed.data;
      const result = await sendClientMessage({ clientId, name: client.name, email: client.email, subject, body });
      // Record it either way, so the thread shows what was attempted. The admin sees a failure
      // right here, so it starts as read (later bounces reported by the webhook mark it unread).
      await recordMessage(
        {
          client_id: clientId,
          direction: "outbound",
          kind: "manual",
          subject,
          body_text: result.text,
          to_email: client.email,
          status: result.ok ? "sent" : "failed",
          error: result.ok ? null : result.error,
          resend_id: result.ok ? result.id : null,
          read_at: new Date().toISOString(),
        },
        supabase,
      );
      refresh();
      if (!result.ok) {
        log.warn({ clientId, customer: maskEmail(client.email), msg: result.error }, "client email not sent");
        return fail(`The email wasn't sent: ${result.error}`);
      }
      log.info({ clientId, customer: maskEmail(client.email) }, "client email sent");
      return { status: "success", message: `Email sent to ${client.name}.`, at };
    },
    (ref) => fail(unexpected(ref)),
  );
}

type Result = { ok: true } | { ok: false; error: string };

export async function updateClientStatus(id: string, status: ClientStatus): Promise<Result> {
  return runAction<Result>(
    "updateClientStatus",
    async ({ log, ref }) => {
      await requireAdmin();
      if (!UUID.safeParse(id).success) return { ok: false, error: "That client doesn't exist." };
      if (!clientStatuses.includes(status)) return { ok: false, error: "Unknown status." };
      const supabase = await createClient();
      const { data, error } = await supabase.from("clients").update({ status }).eq("id", id).select("id");
      if (error) {
        log.error({ clientId: id, status, code: error.code, msg: error.message }, "client status update failed");
        return { ok: false, error: `Couldn't update the client. (Reference: ${ref})` };
      }
      if (!data?.length) return { ok: false, error: "That client no longer exists." };
      log.info({ clientId: id, status }, "client status changed");
      refresh();
      return { ok: true };
    },
    (ref) => ({ ok: false, error: unexpected(ref) }),
  );
}

/** Opening a conversation marks its replies and delivery failures as seen (clears the bell). */
export async function markThreadRead(clientId: string): Promise<void> {
  await runAction(
    "markThreadRead",
    async ({ log }) => {
      await requireAdmin();
      if (!UUID.safeParse(clientId).success) return;
      const supabase = await createClient();
      const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("client_id", clientId)
        .is("read_at", null);
      if (error) log.warn({ clientId, msg: error.message }, "couldn't mark thread read");
    },
    () => undefined,
  );
}

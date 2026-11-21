import { clientIdFromRecipients, getReceivedEmail, isWebhookConfigured, verifyWebhook } from "@/lib/email";
import { maskEmail, moduleLogger, newRef } from "@/lib/server/logger";
import { createServiceClient, isServiceConfigured } from "@/lib/supabase/service";

const log = moduleLogger("webhook.resend");

/**
 * Resend webhook: inbound client replies (`email.received`) and delivery status of the emails
 * we sent. Configure it in Resend → Webhooks, pointing at /api/webhooks/resend.
 *
 * Every request must carry a valid Svix signature (RESEND_WEBHOOK_SECRET). There is no admin
 * session here, so writes use the service client.
 */
export async function POST(request: Request) {
  if (!isWebhookConfigured || !isServiceConfigured) {
    log.warn("webhook called but RESEND_WEBHOOK_SECRET / SUPABASE_SERVICE_ROLE_KEY aren't set");
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const payload = await request.text();
  let event: ReturnType<typeof verifyWebhook>;
  try {
    event = verifyWebhook(payload, request.headers);
  } catch (err) {
    log.warn({ err }, "rejected webhook: invalid signature");
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  const ref = newRef();
  const evLog = log.child({ ref, type: event.type });
  try {
    switch (event.type) {
      case "email.received":
        await handleReceived(event.data, evLog);
        break;
      case "email.delivered":
        await setStatus(event.data.email_id, "delivered", null, evLog);
        break;
      case "email.bounced":
        await setStatus(event.data.email_id, "bounced", event.data.bounce?.message ?? "Bounced", evLog);
        break;
      case "email.failed":
        await setStatus(event.data.email_id, "failed", event.data.failed?.reason ?? "Failed", evLog);
        break;
      case "email.suppressed":
        await setStatus(event.data.email_id, "failed", event.data.suppressed?.message ?? "Suppressed", evLog);
        break;
      default:
        evLog.debug("ignored webhook event");
    }
  } catch (err) {
    // 500 → Resend retries later. Inserts are idempotent (unique resend_id), so retries are safe.
    evLog.error({ err }, "webhook handling failed");
    return Response.json({ error: "failed", ref }, { status: 500 });
  }
  return Response.json({ ok: true });
}

type Log = typeof log;

/** "Jane Doe <jane@example.com>" → "jane@example.com" */
function address(from: string) {
  return (/<([^>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase();
}

/**
 * Drops the quoted history most mail apps append to a reply ("On … wrote:", "> …",
 * "-----Original Message-----"), so the thread shows what the client actually wrote.
 */
function stripQuoted(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex(
    (l) =>
      /^\s*On\s.+wrote:\s*$/i.test(l) ||
      /^\s*-{2,}\s*Original Message\s*-{2,}/i.test(l) ||
      /^\s*From:\s.+$/i.test(l) ||
      /^\s*>/.test(l),
  );
  const kept = (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
  return kept || text.trim();
}

/** HTML-only emails: a readable plain-text fallback (never rendered as HTML). */
function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
}

async function handleReceived(
  data: { email_id: string; from: string; to: string[]; cc: string[]; received_for: string[]; subject: string },
  evLog: Log,
) {
  const db = createServiceClient();
  const sender = address(data.from);

  // The reply+<clientId>@ address we set as Reply-To identifies the client. Fall back to the
  // sender's address for clients who start a new email instead of replying.
  let clientId = clientIdFromRecipients([...(data.to ?? []), ...(data.cc ?? []), ...(data.received_for ?? [])]);
  if (clientId) {
    const { data: row } = await db.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!row) clientId = null;
  }
  if (!clientId) {
    // Case-insensitive exact match: escape ilike's wildcards (`_` is common in addresses).
    const exact = sender.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: row } = await db.from("clients").select("id").ilike("email", exact).maybeSingle();
    clientId = (row?.id as string | undefined) ?? null;
  }
  if (!clientId) {
    // Unknown senders are not turned into clients (keeps spam out of the admin).
    evLog.info({ from: maskEmail(sender) }, "inbound email from unknown sender ignored");
    return;
  }

  const email = await getReceivedEmail(data.email_id);
  const raw = email.text ?? (email.html ? htmlToText(email.html) : "");
  const body = stripQuoted(raw).slice(0, 100_000);

  const { error } = await db.from("messages").upsert(
    {
      client_id: clientId,
      direction: "inbound",
      kind: "reply",
      subject: (data.subject ?? "").slice(0, 500),
      body_text: body,
      from_email: sender,
      to_email: (data.to ?? [])[0] ?? null,
      status: "received",
      resend_id: data.email_id,
      read_at: null,
    },
    { onConflict: "resend_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`insert failed: ${error.message}`);
  evLog.info({ clientId, from: maskEmail(sender) }, "client reply recorded");
}

async function setStatus(resendId: string, status: "delivered" | "bounced" | "failed", error: string | null, evLog: Log) {
  const db = createServiceClient();
  let query = db.from("messages").update(
    status === "delivered"
      ? { status }
      : // A delivery problem becomes unread again so it shows in the notification bell.
        { status, error: error?.slice(0, 1000), read_at: null },
  );
  query = query.eq("resend_id", resendId);
  // Events can arrive out of order: never let "delivered" overwrite a bounce or failure.
  if (status === "delivered") query = query.eq("status", "sent");
  const { error: dbError } = await query;
  if (dbError) throw new Error(`status update failed: ${dbError.message}`);
  evLog.info({ resendId, status }, "message status updated");
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { moduleLogger } from "@/lib/server/logger";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isServiceConfigured } from "@/lib/supabase/service";

const log = moduleLogger("data.messages");

export type MessageDirection = "outbound" | "inbound";
export type MessageKind = "manual" | "booking_received" | "booking_confirmed" | "reply";
export type MessageStatus = "sent" | "delivered" | "bounced" | "failed" | "received";

export type Message = {
  id: string;
  createdAt: string;
  bookingId: string | null;
  direction: MessageDirection;
  kind: MessageKind;
  subject: string;
  body: string;
  fromEmail: string | null;
  toEmail: string | null;
  status: MessageStatus;
  error: string | null;
};

export type MessageRow = {
  client_id: string;
  booking_id?: string | null;
  direction: MessageDirection;
  kind: MessageKind;
  subject: string;
  body_text: string;
  from_email?: string | null;
  to_email?: string | null;
  status: MessageStatus;
  error?: string | null;
  resend_id?: string | null;
  read_at?: string | null;
};

/**
 * Saves a message to the client's thread. Best effort: a failure is logged, never thrown, so it
 * can't break the email flow that called it.
 *
 * `db` is the admin's own client when there is a session; otherwise (guest booking flow) the
 * service client is used, and recording is skipped if that isn't configured.
 */
export async function recordMessage(row: MessageRow, db?: SupabaseClient) {
  const client = db ?? (isServiceConfigured ? createServiceClient() : null);
  if (!client) {
    log.warn({ kind: row.kind }, "SUPABASE_SERVICE_ROLE_KEY not set; message not recorded");
    return;
  }
  try {
    const { error } = await client.from("messages").insert(row);
    if (error) log.error({ kind: row.kind, code: error.code, msg: error.message }, "couldn't record message");
  } catch (err) {
    log.error({ err, kind: row.kind }, "couldn't record message");
  }
}

type Row = {
  id: string;
  created_at: string;
  booking_id: string | null;
  direction: MessageDirection;
  kind: MessageKind;
  subject: string;
  body_text: string;
  from_email: string | null;
  to_email: string | null;
  status: MessageStatus;
  error: string | null;
};

/** The client's conversation, oldest first. Admin only (RLS). */
export async function getMessages(clientId: string, limit = 500): Promise<Message[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, created_at, booking_id, direction, kind, subject, body_text, from_email, to_email, status, error")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    log.error({ clientId, code: error.code, msg: error.message }, "messages query failed");
    throw new Error(`Couldn't load messages: ${error.message}`);
  }
  return (data as Row[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    bookingId: r.booking_id,
    direction: r.direction,
    kind: r.kind,
    subject: r.subject,
    body: r.body_text,
    fromEmail: r.from_email,
    toEmail: r.to_email,
    status: r.status,
    error: r.error,
  }));
}

// ---------------------------------------------------------------------------
// Notification bell
// ---------------------------------------------------------------------------

export type NotificationItem = { id: string; href: string; title: string; detail: string; at: string };
export type Notifications = {
  total: number;
  replies: { count: number; items: NotificationItem[] };
  bookings: { count: number; items: NotificationItem[] };
  failed: { count: number; items: NotificationItem[] };
};

type MessageAlertRow = {
  id: string;
  created_at: string;
  subject: string;
  body_text: string;
  error: string | null;
  client_id: string;
  clients: { name: string } | null;
};

const preview = (s: string, n = 90) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Unread replies, unopened new bookings and failed emails (latest 5 of each). Admin only. */
export async function getNotifications(): Promise<Notifications> {
  const supabase = await createClient();
  const exact = { count: "exact" } as const;
  const alertColumns = "id, created_at, subject, body_text, error, client_id, clients(name)";
  const [replies, failed, bookings] = await Promise.all([
    supabase
      .from("messages")
      .select(alertColumns, exact)
      .eq("direction", "inbound")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("messages")
      .select(alertColumns, exact)
      .eq("direction", "outbound")
      .in("status", ["bounced", "failed"])
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("bookings")
      .select("id, created_at, name, address", exact)
      .eq("status", "new")
      .is("seen_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  for (const [name, res] of Object.entries({ replies, failed, bookings })) {
    if (res.error) log.error({ section: name, code: res.error.code, msg: res.error.message }, "notification query failed");
  }

  const messageItems = (rows: MessageAlertRow[] | null, detail: (r: MessageAlertRow) => string) =>
    (rows ?? []).map((r) => ({
      id: r.id,
      href: `/admin/clients/${r.client_id}`,
      title: r.clients?.name ?? "Unknown client",
      detail: detail(r),
      at: r.created_at,
    }));

  const result: Notifications = {
    total: 0,
    replies: {
      count: replies.count ?? 0,
      items: messageItems(replies.data as MessageAlertRow[] | null, (r) => preview(r.body_text || r.subject)),
    },
    failed: {
      count: failed.count ?? 0,
      items: messageItems(failed.data as MessageAlertRow[] | null, (r) =>
        preview(`${r.subject}: ${r.error ?? "not delivered"}`),
      ),
    },
    bookings: {
      count: bookings.count ?? 0,
      items: ((bookings.data ?? []) as { id: string; created_at: string; name: string; address: string }[]).map((b) => ({
        id: b.id,
        href: `/admin/bookings/${b.id}`,
        title: b.name,
        detail: preview(b.address),
        at: b.created_at,
      })),
    },
  };
  result.total = result.replies.count + result.failed.count + result.bookings.count;
  return result;
}

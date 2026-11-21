import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { recordMessage, type MessageKind } from "@/lib/data/messages";
import { maskEmail, moduleLogger } from "@/lib/server/logger";
import { siteUrl } from "@/lib/site";

const log = moduleLogger("email");

// Transactional emails for bookings, sent with Resend (https://resend.com).
// Configure in .env.local — see .env.example. When not configured, sends are skipped with a log
// line, so bookings still work in development.

const API_KEY = process.env.RESEND_API_KEY ?? "";
/** Verified sender, e.g. `Solar Layout <bookings@yourdomain.com>`. Resend's test sender works without a domain. */
const FROM = process.env.EMAIL_FROM || "Solar Layout <onboarding@resend.dev>";
/** Where new-booking alerts go (comma-separated for several). */
const ADMIN_EMAILS = (process.env.ADMIN_EMAIL ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
/** NEXT_PUBLIC_SITE_URL, else the Vercel production URL (see lib/site.ts). */
const SITE_URL = siteUrl;
/**
 * Domain set up for receiving in Resend (MX records), e.g. `inbound.yourdomain.com`. Client emails
 * use `reply+<clientId>@` this domain as Reply-To, so replies land in the right client's thread.
 */
const INBOUND_DOMAIN = (process.env.INBOUND_DOMAIN ?? "").trim().replace(/^@/, "");
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "";

export const isEmailConfigured = Boolean(API_KEY);
/** Replies can come back into the thread (receiving domain + signed webhook). */
export const isInboundConfigured = Boolean(API_KEY && INBOUND_DOMAIN && WEBHOOK_SECRET);
export const isWebhookConfigured = Boolean(API_KEY && WEBHOOK_SECRET);

let client: Resend | null = null;
const resend = () => (client ??= new Resend(API_KEY));

/** Where a client's replies should go: their thread when receiving is set up, else the admin inbox. */
export function replyAddress(clientId: string | null | undefined): string | undefined {
  if (clientId && INBOUND_DOMAIN) return `reply+${clientId}@${INBOUND_DOMAIN}`;
  return ADMIN_EMAILS[0];
}

/** The client id from a `reply+<uuid>@…` address, if any of the recipients carries one. */
export function clientIdFromRecipients(addresses: string[]): string | null {
  for (const a of addresses) {
    const m = /reply\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i.exec(a);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

export type BookingEmailData = {
  name: string;
  email: string;
  phone: string | null;
  preferredDate: string; // YYYY-MM-DD
  address: string;
  notes: string | null;
  /** e.g. "Medium house · 14 panels · 5.7 kWp · Hybrid Inverter 5 kW ×1" */
  layoutSummary: string | null;
  /** When known, the customer email is recorded in this client's conversation. */
  clientId?: string | null;
  bookingId?: string | null;
};

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; /** Email isn't configured; nothing was attempted. */ skipped?: boolean };

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

async function send(
  to: string | string[],
  subject: string,
  html: string,
  text: string,
  replyTo?: string,
): Promise<SendResult> {
  const recipients = [to].flat().map(maskEmail);
  if (!API_KEY) {
    log.warn({ subject, to: recipients }, "RESEND_API_KEY not set; email skipped");
    return { ok: false, error: "Email isn't configured.", skipped: true };
  }
  // Never throw: an email problem must not undo a saved booking.
  try {
    const { data, error } = await resend().emails.send({ from: FROM, to, subject, html, text, replyTo });
    if (error) {
      // e.g. "validation_error: You can only send testing emails to your own email address"
      log.error({ subject, to: recipients, name: error.name, msg: error.message }, "email rejected by Resend");
      return { ok: false, error: error.message };
    }
    log.info({ subject, to: recipients, emailId: data?.id }, "email sent");
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    log.error({ err, subject, to: recipients }, "email send threw");
    return { ok: false, error: "The email service couldn't be reached." };
  }
}

/** Saves a customer email in the client's thread (unless email isn't configured at all). */
async function recordCustomerEmail(
  b: BookingEmailData,
  kind: MessageKind,
  m: { subject: string; text: string },
  result: SendResult,
  db?: SupabaseClient,
) {
  if (!b.clientId || (!result.ok && result.skipped)) return;
  await recordMessage(
    {
      client_id: b.clientId,
      booking_id: b.bookingId ?? null,
      direction: "outbound",
      kind,
      subject: m.subject,
      body_text: m.text,
      from_email: FROM,
      to_email: b.email,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
      resend_id: result.ok ? result.id : null,
      // A failed automatic email is unread, so it shows in the notification bell.
      read_at: result.ok ? new Date().toISOString() : null,
    },
    db,
  );
}

/** Booking received → customer (acknowledgement) + admin (alert). */
export async function sendBookingReceived(b: BookingEmailData) {
  const customer = customerReceived(b);
  const admin = adminNewBooking(b);
  await Promise.allSettled([
    send(b.email, customer.subject, customer.html, customer.text, replyAddress(b.clientId)).then((r) =>
      recordCustomerEmail(b, "booking_received", customer, r),
    ),
    ADMIN_EMAILS.length > 0
      ? send(ADMIN_EMAILS, admin.subject, admin.html, admin.text, b.email) // reply goes to the customer
      : Promise.resolve(log.warn("ADMIN_EMAIL not set; admin alert skipped")),
  ]);
}

/** Admin marked the booking as confirmed → customer. `db`: the admin's client, for recording. */
export async function sendBookingConfirmed(b: BookingEmailData, db?: SupabaseClient) {
  const m = customerConfirmed(b);
  const result = await send(b.email, m.subject, m.html, m.text, replyAddress(b.clientId));
  await recordCustomerEmail(b, "booking_confirmed", m, result, db);
}

/** A message the admin wrote in the client's conversation. The caller records it. */
export async function sendClientMessage(c: {
  clientId: string;
  name: string;
  email: string;
  subject: string;
  body: string;
}): Promise<SendResult & { html: string; text: string }> {
  const paragraphs = c.body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;color:#374151;line-height:1.6">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = shell(paragraphs, "Reply to this email to continue the conversation.");
  const text = c.body.trim();
  const result = await send(c.email, c.subject, html, text, replyAddress(c.clientId));
  return { ...result, html, text };
}

// ---------------------------------------------------------------------------
// Receiving (Resend webhook)
// ---------------------------------------------------------------------------

/** Verifies a webhook's signature and returns the parsed event; throws if it isn't genuine. */
export function verifyWebhook(payload: string, headers: Headers) {
  return resend().webhooks.verify({
    payload,
    // Resend signs webhooks with Svix; a missing header just fails verification.
    headers: {
      id: headers.get("svix-id") ?? "",
      timestamp: headers.get("svix-timestamp") ?? "",
      signature: headers.get("svix-signature") ?? "",
    },
    webhookSecret: WEBHOOK_SECRET,
  });
}

/** Full content of a received email (the webhook only carries metadata). */
export async function getReceivedEmail(id: string) {
  const { data, error } = await resend().emails.receiving.get(id);
  if (error || !data) throw new Error(`Couldn't fetch received email: ${error?.message ?? "no data"}`);
  return data;
}

// ---------------------------------------------------------------------------
// Templates (inline styles: email clients ignore stylesheets)
// ---------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" }).format(d);
}

function rows(b: BookingEmailData) {
  const list: [string, string | null][] = [
    ["Preferred date", formatDate(b.preferredDate)],
    ["Address", b.address],
    ["Name", b.name],
    ["Email", b.email],
    ["Phone", b.phone],
    ["Layout", b.layoutSummary],
    ["Notes", b.notes],
  ];
  return list.filter((r): r is [string, string] => Boolean(r[1]));
}

/** Branded email frame. `inner` is trusted HTML (escape any user text first); `footer` is plain text. */
function shell(inner: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td>
<p style="margin:0 0 16px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#15803d;font-weight:600">Solar Layout</p>
${inner}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#9ca3af">${esc(footer)}</p>
</td></tr></table></body></html>`;
}

function layout(title: string, intro: string, b: BookingEmailData, cta?: { label: string; href: string }) {
  const table = rows(b)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${esc(k)}</td>` +
        `<td style="padding:6px 0;color:#111827;white-space:pre-wrap">${esc(v)}</td></tr>`,
    )
    .join("");
  const button = cta
    ? `<p style="margin:24px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${esc(cta.label)}</a></p>`
    : "";
  const html = shell(
    `<h1 style="margin:0 0 12px;font-size:20px;color:#111827">${esc(title)}</h1>
<p style="margin:0 0 20px;color:#374151;line-height:1.5">${esc(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.4">${table}</table>
${button}`,
    `You're receiving this because a site assessment was requested on ${SITE_URL.replace(/^https?:\/\//, "")}.`,
  );
  const text = [
    title,
    "",
    intro,
    "",
    ...rows(b).map(([k, v]) => `${k}: ${v}`),
    ...(cta ? ["", `${cta.label}: ${cta.href}`] : []),
  ].join("\n");
  return { html, text };
}

function customerReceived(b: BookingEmailData) {
  const first = b.name.split(" ")[0];
  const { html, text } = layout(
    "We received your assessment request",
    `Hi ${first}, thanks for booking a free site assessment. We'll check availability and email you to confirm your visit date — usually within one business day. Reply to this email if anything changes.`,
    b,
  );
  return { subject: "We received your site assessment request", html, text };
}

function adminNewBooking(b: BookingEmailData) {
  const { html, text } = layout(
    `New booking: ${b.name}`,
    "A new site assessment was requested. Reply to this email to reach the customer directly.",
    b,
    { label: "Open bookings", href: `${SITE_URL}/admin/bookings` },
  );
  return { subject: `New booking — ${b.name}, ${formatDate(b.preferredDate)}`, html, text };
}

function customerConfirmed(b: BookingEmailData) {
  const first = b.name.split(" ")[0];
  const { html, text } = layout(
    "Your site assessment is confirmed",
    `Hi ${first}, your visit is booked for ${formatDate(b.preferredDate)}. Our installer will check your roof, wiring and shading, and you'll get a fixed quote based on your layout. Reply to this email if you need to reschedule.`,
    b,
  );
  return { subject: `Confirmed: your site assessment on ${formatDate(b.preferredDate)}`, html, text };
}

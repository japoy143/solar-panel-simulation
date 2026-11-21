import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  PhoneIcon,
} from "lucide-react";
import { markThreadRead } from "@/app/admin/(dashboard)/clients/actions";
import { bookingStatusTones } from "@/components/admin/booking-status-select";
import { ClientStatusSelect } from "@/components/admin/client-status-select";
import { MarkOnOpen } from "@/components/admin/mark-on-open";
import { MessageComposer } from "@/components/admin/message-composer";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { bookingStatusLabels } from "@/lib/clients";
import { getClient } from "@/lib/data/clients";
import { getMessages, type Message } from "@/lib/data/messages";
import { isEmailConfigured, isInboundConfigured } from "@/lib/email";
import { cn } from "@/lib/utils";

// Admin pages check the session and load live data on every request, so they block on the
// server by design. Opt out of instant-navigation validation (see docs: instant-navigation#opting-out).
export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

const kindLabels: Partial<Record<Message["kind"], string>> = {
  booking_received: "Automatic · booking received",
  booking_confirmed: "Automatic · booking confirmed",
};

export default async function ClientDetailPage({ params }: PageProps<"/admin/clients/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const client = UUID.test(id) ? await getClient(id) : null;
  if (!client) notFound();
  const messages = await getMessages(client.id);

  const lastSubject = messages.findLast((m) => m.subject)?.subject;
  const defaultSubject = lastSubject
    ? /^re:/i.test(lastSubject)
      ? lastSubject
      : `Re: ${lastSubject}`
    : "Your solar site assessment";

  return (
    <>
      <MarkOnOpen action={markThreadRead.bind(null, client.id)} />
      <Link
        href="/admin/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        All clients
      </Link>

      <PageHeader
        eyebrow="Client"
        title={client.name}
        description={`Client since ${dateFmt.format(new Date(client.createdAt))}`}
        action={<ClientStatusSelect id={client.id} name={client.name} status={client.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
          <CardHeader className="border-b py-4">
            <CardTitle className="flex items-center gap-2">
              <MessageSquareIcon className="size-4 text-primary" />
              Conversation
            </CardTitle>
          </CardHeader>

          {/* column-reverse keeps the view pinned to the newest message, no script needed */}
          <div className="flex max-h-[60svh] min-h-72 flex-col-reverse overflow-y-auto bg-muted/30 p-4">
            {messages.length === 0 ? (
              <div className="m-auto flex flex-col items-center gap-2 text-center">
                <MessageSquareIcon className="size-6 text-primary" />
                <p className="text-sm font-medium">No messages yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Emails you send from here, the automatic booking emails, and {client.name.split(" ")[0]}
                  &apos;s replies will all appear in this thread.
                </p>
              </div>
            ) : (
              <ol className="flex flex-col gap-4">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </ol>
            )}
          </div>

          <MessageComposer
            clientId={client.id}
            clientName={client.name.split(" ")[0]}
            defaultSubject={defaultSubject}
            disabled={!isEmailConfigured}
            hint={
              !isEmailConfigured
                ? "Email isn't set up yet (RESEND_API_KEY). See the README."
                : isInboundConfigured
                  ? undefined
                  : "Sent by email. Replies go to your admin inbox until receiving is set up (see the README)."
            }
          />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4 text-sm">
                <Detail icon={MailIcon} label="Email">
                  <a href={`mailto:${client.email}`} className="break-all text-primary-strong hover:underline">
                    {client.email}
                  </a>
                </Detail>
                <Detail icon={PhoneIcon} label="Phone">
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className="text-primary-strong hover:underline">
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not given</span>
                  )}
                </Detail>
                <Detail icon={MapPinIcon} label="Address">
                  {client.address ? (
                    <span className="whitespace-pre-line">{client.address}</span>
                  ) : (
                    <span className="text-muted-foreground">Not given</span>
                  )}
                </Detail>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {client.bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings.</p>
              ) : (
                <ul className="-mx-2 divide-y">
                  {client.bookings.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-muted/60"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-medium">
                            <CalendarIcon className="size-3.5 text-muted-foreground" />
                            {dateFmt.format(new Date(b.preferredDate))}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{b.address}</span>
                        </span>
                        <StatusPill tone={bookingStatusTones[b.status]}>{bookingStatusLabels[b.status]}</StatusPill>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message: m }: { message: Message }) {
  const outbound = m.direction === "outbound";
  const problem = m.status === "failed" || m.status === "bounced";
  const StatusIcon = problem ? CircleAlertIcon : m.status === "delivered" ? CheckCheckIcon : CheckIcon;
  const statusLabel = { sent: "Sent", delivered: "Delivered", bounced: "Bounced", failed: "Not sent", received: "" }[
    m.status
  ];

  return (
    <li className={cn("flex flex-col gap-1", outbound ? "items-end" : "items-start")}>
      {kindLabels[m.kind] && <span className="eyebrow px-1 text-muted-foreground">{kindLabels[m.kind]}</span>}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-4 py-3 text-sm shadow-xs sm:max-w-[75%]",
          outbound ? "rounded-br-md border-primary/20 bg-primary/10" : "rounded-bl-md bg-background",
          problem && "border-destructive/40",
        )}
      >
        {m.subject && <p className="mb-1 font-medium">{m.subject}</p>}
        <p className="leading-relaxed break-words whitespace-pre-wrap">{m.body}</p>
      </div>
      <span
        className={cn(
          "flex items-center gap-1 px-1 text-[11px] text-muted-foreground",
          problem && "text-destructive",
        )}
      >
        <time dateTime={m.createdAt}>{dateTimeFmt.format(new Date(m.createdAt))}</time>
        {outbound && (
          <>
            <span aria-hidden>·</span>
            <StatusIcon className="size-3" aria-hidden />
            {statusLabel}
            {problem && m.error && <span className="max-w-64 truncate">: {m.error}</span>}
          </>
        )}
      </span>
    </li>
  );
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="eyebrow flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

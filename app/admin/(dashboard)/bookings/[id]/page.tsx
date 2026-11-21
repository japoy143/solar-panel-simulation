import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  LayoutGridIcon,
  MailIcon,
  MessageSquareIcon,
  MapPinIcon,
  PhoneIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { markBookingSeen } from "@/app/admin/(dashboard)/bookings/actions";
import { BookingStatusSelect } from "@/components/admin/booking-status-select";
import { MarkOnOpen } from "@/components/admin/mark-on-open";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { LayoutPreviewLoader } from "@/components/simulator/layout-preview-loader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getBooking, type BookingLayoutDetail } from "@/lib/data/bookings";
import { getAdminProducts } from "@/lib/data/products";
import type { Product } from "@/lib/products";

// Admin pages check the session and load live data on every request, so they block on the
// server by design. Opt out of instant-navigation validation (see docs: instant-navigation#opting-out).
export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const numberFmt = new Intl.NumberFormat("en-US");

export default async function BookingDetailPage({ params }: PageProps<"/admin/bookings/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const booking = UUID.test(id) ? await getBooking(id) : null;
  if (!booking) notFound();

  // Products for the 3D preview. All of them, not just active ones: an item the customer placed
  // may since have been hidden from the catalog. Only fetched when there's something to draw.
  const slugs = new Set(booking.layout?.items.map((i) => i.slug));
  const previewProducts = slugs.size > 0 ? (await getAdminProducts()).filter((p) => slugs.has(p.slug)) : [];

  return (
    <>
      <MarkOnOpen action={markBookingSeen.bind(null, booking.id)} />
      <Link
        href="/admin/bookings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        All bookings
      </Link>

      <PageHeader
        eyebrow="Booking"
        title={booking.name}
        description={`Requested ${dateTimeFmt.format(new Date(booking.createdAt))}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {booking.clientId && (
              <Link
                href={`/admin/clients/${booking.clientId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <MessageSquareIcon data-icon="inline-start" />
                Message client
              </Link>
            )}
            <BookingStatusSelect id={booking.id} name={booking.name} status={booking.status} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Site visit</CardTitle>
              <CardDescription>Where and when the customer would like the assessment.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail icon={CalendarIcon} label="Preferred date">
                  {dateFmt.format(new Date(booking.preferredDate))}
                </Detail>
                <Detail icon={ClockIcon} label="Requested">
                  {dateTimeFmt.format(new Date(booking.createdAt))}
                </Detail>
                <Detail icon={MapPinIcon} label="Address" className="sm:col-span-2">
                  <span className="whitespace-pre-line">{booking.address}</span>
                </Detail>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Anything the customer added to the request.</CardDescription>
            </CardHeader>
            <CardContent>
              {booking.notes ? (
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{booking.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes.</p>
              )}
            </CardContent>
          </Card>

          <LayoutCard layout={booking.layout} products={previewProducts} />
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-5">
              <Detail icon={MailIcon} label="Email">
                <a href={`mailto:${booking.email}`} className="break-all text-primary-strong hover:underline">
                  {booking.email}
                </a>
              </Detail>
              <Detail icon={PhoneIcon} label="Phone">
                {booking.phone ? (
                  <a href={`tel:${booking.phone}`} className="text-primary-strong hover:underline">
                    {booking.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not given</span>
                )}
              </Detail>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Detail({
  icon: Icon,
  label,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <dt className="eyebrow flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1.5 text-sm">{children}</dd>
    </div>
  );
}

function LayoutCard({ layout, products }: { layout: BookingLayoutDetail | null; products: Product[] }) {
  if (!layout) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Simulator layout</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The customer didn&apos;t attach a layout.</p>
        </CardContent>
      </Card>
    );
  }

  const figures = [
    { label: "Panels", value: numberFmt.format(layout.panels) },
    { label: "System size", value: `${layout.kwp.toFixed(1)} kWp` },
    layout.yearlyKwh != null && { label: "Est. yearly output", value: `${numberFmt.format(layout.yearlyKwh)} kWh` },
    layout.inverterKw != null && { label: "Inverter", value: `${layout.inverterKw} kW` },
    layout.batteryKwh != null && { label: "Battery", value: `${layout.batteryKwh} kWh` },
    layout.backupLimitKw != null && { label: "Backup output", value: `${layout.backupLimitKw} kW` },
  ].filter((f) => f !== false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGridIcon className="size-4 text-primary" />
          Simulator layout
        </CardTitle>
        <CardDescription>
          {layout.buildingName ?? "Building not specified"} · as planned by the customer, not yet checked on site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LayoutPreviewFigure layout={layout} products={products} />

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {figures.map((f) => (
            <div key={f.label} className="rounded-lg border p-3">
              <dt className="eyebrow text-muted-foreground">{f.label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>

        {layout.products.length > 0 && (
          <div>
            <h3 className="eyebrow mb-2 text-muted-foreground">Equipment</h3>
            <ul className="divide-y rounded-lg border">
              {layout.products.map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                  <span className="min-w-0 break-words">{p.name}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">×{p.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {layout.warnings.length > 0 && (
          <ul className="space-y-2">
            {layout.warnings.map((w) => (
              <li
                key={w}
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LayoutPreviewFigure({ layout, products }: { layout: BookingLayoutDetail; products: Product[] }) {
  if (!layout.buildingId || layout.items.length === 0) return null;
  const known = new Set(products.map((p) => p.slug));
  const missing = layout.items.filter((i) => !known.has(i.slug)).length;
  return (
    <figure className="space-y-2">
      <div className="aspect-[16/10] overflow-hidden rounded-lg border bg-muted">
        <LayoutPreviewLoader buildingId={layout.buildingId} items={layout.items} products={products} />
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Drag to rotate.
        {missing > 0 && ` ${missing} item${missing === 1 ? "" : "s"} not shown: the product was deleted from the catalog.`}
      </figcaption>
    </figure>
  );
}

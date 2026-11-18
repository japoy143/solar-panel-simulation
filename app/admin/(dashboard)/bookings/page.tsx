import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableRow } from "@/components/admin/clickable-row";
import { ListFilters, ListFiltersFallback } from "@/components/admin/list-filters";
import { BookingStatusSelect } from "@/components/admin/booking-status-select";
import { PageHeader } from "@/components/admin/page-header";
import { bookingStatusLabels, bookingStatusList } from "@/lib/clients";
import { bookingStatuses, getBookings, type BookingStatus } from "@/lib/data/bookings";
import { param } from "@/lib/data/search";

// Admin pages check the session and load live data on every request, so they block on the
// server by design. Opt out of instant-navigation validation (see docs: instant-navigation#opting-out).
export const instant = false;

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

const filterOptions = bookingStatusList.map((s) => ({ value: s, label: bookingStatusLabels[s] }));
const PLACEHOLDER = "Search name, email, phone or address";

export default async function AdminBookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp.q);
  const rawStatus = param(sp.status);
  const status = bookingStatuses.includes(rawStatus as BookingStatus) ? (rawStatus as BookingStatus) : undefined;
  const bookings = await getBookings({ q, status });
  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader
        eyebrow="Requests"
        title="Bookings"
        description="Site assessment requests submitted from the booking page."
      />

      <Suspense fallback={<ListFiltersFallback placeholder={PLACEHOLDER} statuses={filterOptions} />}>
        <ListFilters placeholder={PLACEHOLDER} statuses={filterOptions} />
      </Suspense>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Customer</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Preferred date</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="pr-4 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  {filtered ? "No bookings match your search." : "No bookings yet."}
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((b) => (
                <ClickableRow key={b.id} href={`/admin/bookings/${b.id}`} className="align-top">
                  <TableCell className="pl-4">
                    <span className="flex items-center gap-2">
                      {b.status === "new" && !b.seenAt && (
                        <span className="size-2 shrink-0 rounded-full bg-primary" title="Not opened yet">
                          <span className="sr-only">Not opened yet: </span>
                        </span>
                      )}
                      <Link href={`/admin/bookings/${b.id}`} className="font-medium hover:underline">
                        {b.name}
                      </Link>
                    </span>
                    <a href={`mailto:${b.email}`} className="block text-xs text-primary-strong hover:underline">
                      {b.email}
                    </a>
                    {b.phone && <p className="text-xs text-muted-foreground">{b.phone}</p>}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    <p>{b.address}</p>
                    {b.layoutSummary && <p className="mt-1 text-xs text-primary-strong">Layout: {b.layoutSummary}</p>}
                    {b.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{b.notes}</p>}
                  </TableCell>
                  <TableCell>{dateFmt.format(new Date(b.preferredDate))}</TableCell>
                  <TableCell className="text-muted-foreground">{dateTimeFmt.format(new Date(b.createdAt))}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <BookingStatusSelect id={b.id} name={b.name} status={b.status} />
                  </TableCell>
                </ClickableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

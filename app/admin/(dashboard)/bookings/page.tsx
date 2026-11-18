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
import { BookingStatusSelect } from "@/components/admin/booking-status-select";
import { PageHeader } from "@/components/admin/page-header";
import { getBookings } from "@/lib/data/bookings";

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminBookingsPage() {
  await requireAdmin();
  const bookings = await getBookings();

  return (
    <>
      <PageHeader
        eyebrow="Requests"
        title="Bookings"
        description="Site assessment requests submitted from the booking page."
      />

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
                  No bookings yet.
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((b) => (
                <TableRow key={b.id} className="align-top">
                  <TableCell className="pl-4">
                    <p className="font-medium">{b.name}</p>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

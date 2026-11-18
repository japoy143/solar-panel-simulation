import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CalendarCheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";

import { getBookings, getDashboardStats } from "@/lib/data/bookings";

// Admin pages check the session and load live data on every request, so they block on the
// server by design. Opt out of instant-navigation validation (see docs: instant-navigation#opting-out).
export const instant = false;

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [figures, recent] = await Promise.all([getDashboardStats(), getBookings(5)]);
  const stats = [
    { label: "Bookings this month", value: String(figures.bookingsThisMonth) },
    { label: "Pending requests", value: String(figures.pending) },
    { label: "Active products", value: String(figures.activeProducts) },
    // TODO: needs prices on bookings/quotes.
    { label: "Revenue (MTD)", value: "—" },
  ];

  return (
    <>
      <PageHeader eyebrow="Overview" title="Dashboard" description="Overview of bookings and products." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>
                <span className="eyebrow">{stat.label}</span>
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {stat.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent bookings</CardTitle>
          <CardDescription>The latest assessment requests from the site.</CardDescription>
          <CardAction>
            <Link
              href="/admin/bookings"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View all
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <CalendarCheckIcon className="size-6 text-primary" />
            <p className="text-sm font-medium">No bookings yet</p>
            <p className="text-sm text-muted-foreground">
              New requests from the booking page will show up here.
            </p>
          </div>
          ) : (
            <ul className="divide-y">
              {recent.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{b.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{b.address}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block">{dateFmt.format(new Date(b.preferredDate))}</span>
                    <span className="block text-xs text-muted-foreground capitalize">{b.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

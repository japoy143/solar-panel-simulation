import { Suspense } from "react";
import Link from "next/link";
import { UsersIcon } from "lucide-react";
import { ClickableRow } from "@/components/admin/clickable-row";
import { clientStatusTones } from "@/components/admin/client-status-select";
import { ListFilters, ListFiltersFallback } from "@/components/admin/list-filters";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-select";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { clientStatuses, clientStatusLabels, isClientStatus } from "@/lib/clients";
import { getClients } from "@/lib/data/clients";
import { param } from "@/lib/data/search";

// Admin pages check the session and load live data on every request, so they block on the
// server by design. Opt out of instant-navigation validation (see docs: instant-navigation#opting-out).
export const instant = false;

const dateTimeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const filterOptions = clientStatuses.map((s) => ({ value: s, label: clientStatusLabels[s] }));
const PLACEHOLDER = "Search name, email, phone or address";

export default async function AdminClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp.q);
  const rawStatus = param(sp.status);
  const status = isClientStatus(rawStatus) ? rawStatus : undefined;
  const clients = await getClients({ q, status });
  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Clients"
        description="Everyone who has booked an assessment. Each booking adds or updates its client automatically."
      />

      <Suspense fallback={<ListFiltersFallback placeholder={PLACEHOLDER} statuses={filterOptions} />}>
        <ListFilters placeholder={PLACEHOLDER} statuses={filterOptions} />
      </Suspense>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Client</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="pr-4">Last message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <UsersIcon className="size-6 text-primary" />
                    <p className="font-medium text-foreground">{filtered ? "No matching clients" : "No clients yet"}</p>
                    <p className="text-sm">
                      {filtered
                        ? "Try a different search or status."
                        : "Clients are added automatically when someone books an assessment."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((c) => (
                <ClickableRow key={c.id} href={`/admin/clients/${c.id}`}>
                  <TableCell className="pl-4">
                    <Link href={`/admin/clients/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    <StatusPill tone={clientStatusTones[c.status]}>{clientStatusLabels[c.status]}</StatusPill>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.bookingCount}</TableCell>
                  <TableCell className="pr-4">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {c.lastMessageAt ? dateTimeFmt.format(new Date(c.lastMessageAt)) : "—"}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                          {c.unreadCount}
                          <span className="sr-only"> unread</span>
                        </span>
                      )}
                    </span>
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

import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminMobileBar, AdminSidebar } from "@/components/admin/admin-nav";
import { NotificationBell } from "@/components/admin/notification-bell";
import { requireAdmin } from "@/lib/auth";

// Admin pages check the session and load live data on every request, so they block on the
// server by design. Opt out of instant-navigation validation (see docs: instant-navigation#opting-out).
export const instant = false;

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** Reads the session, so it streams in behind Suspense (required with Cache Components). */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex-1 md:grid md:grid-cols-[240px_1fr]">
      <AdminSidebar />
      <div className="min-w-0">
        <AdminMobileBar />
        <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-24 sm:px-6 md:px-10 md:pt-10">
          <Suspense fallback={<AdminLoading />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </main>
      </div>
      <NotificationBell />
    </div>
  );
}

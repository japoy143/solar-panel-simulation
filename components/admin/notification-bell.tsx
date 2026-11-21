"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BellIcon, CalendarPlusIcon, MailWarningIcon, MessageSquareIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import type { NotificationItem, Notifications } from "@/lib/data/messages";
import { cn } from "@/lib/utils";
import { NOTIFICATIONS_CHANGED } from "./mark-on-open";

const POLL_MS = 60_000;

const timeFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return timeFmt.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return timeFmt.format(hours, "hour");
  return timeFmt.format(Math.round(hours / 24), "day");
}

// One shared store and poller, however many bells are mounted.
let snapshot: Notifications | null = null;
const listeners = new Set<() => void>();
let stopPolling: (() => void) | null = null;

async function load() {
  try {
    const res = await fetch("/api/admin/notifications", { cache: "no-store" });
    if (!res.ok) return;
    snapshot = (await res.json()) as Notifications;
    listeners.forEach((l) => l());
  } catch {
    // Offline or server hiccup: keep the last counts, try again on the next tick.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stopPolling) {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const refetch = () => void load();
    window.addEventListener("focus", refetch);
    window.addEventListener(NOTIFICATIONS_CHANGED, refetch);
    stopPolling = () => {
      clearInterval(timer);
      window.removeEventListener("focus", refetch);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refetch);
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopPolling?.();
      stopPolling = null;
    }
  };
}

const useNotifications = () =>
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => null,
  );

/**
 * Bell with a count badge and a small pop-up listing unread client replies, unopened new
 * bookings and failed emails. Polls /api/admin/notifications every minute, when the window
 * regains focus, when it's opened, and right after a page marks something as read.
 */
export function NotificationBell({ className }: { className?: string }) {
  const data = useNotifications();
  const [open, setOpen] = useState(false);

  const total = data?.total ?? 0;
  const close = () => setOpen(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className={cn(
              // Floating in the bottom-right corner, clear of the iOS home indicator.
              "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-12 rounded-full bg-background shadow-lg hover:bg-muted sm:right-6 sm:bottom-6 [&_svg:not([class*='size-'])]:size-5",
              open && "ring-3 ring-ring/50",
              className,
            )}
            aria-label={total > 0 ? `Notifications (${total} new)` : "Notifications"}
            data-notification-bell=""
          />
        }
      >
        <BellIcon />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-background">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={12} className="w-[min(22rem,calc(100vw-2rem))]">
        <div className="flex items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
          <PopoverTitle>Notifications</PopoverTitle>
          <span className="flex items-center gap-1">
            {total > 0 && <span className="text-xs text-muted-foreground">{total} new</span>}
            <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close notifications">
              <XIcon />
            </Button>
          </span>
        </div>
        <div className="max-h-[min(26rem,calc(100svh-12rem))] overflow-y-auto overscroll-contain">
          {!data ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : total === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <BellIcon className="size-5 text-primary" />
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">New replies and bookings will show up here.</p>
            </div>
          ) : (
            <>
              <Section icon={MessageSquareIcon} title="Replies" group={data.replies} onNavigate={close} />
              <Section icon={CalendarPlusIcon} title="New bookings" group={data.bookings} onNavigate={close} />
              <Section
                icon={MailWarningIcon}
                title="Failed emails"
                group={data.failed}
                onNavigate={close}
                tone="text-destructive"
              />
            </>
          )}
        </div>
        <div className="flex border-t text-xs">
          <Link href="/admin/clients" onClick={close} className="flex-1 px-4 py-2.5 text-center font-medium text-primary-strong hover:bg-muted">
            All clients
          </Link>
          <Link href="/admin/bookings" onClick={close} className="flex-1 border-l px-4 py-2.5 text-center font-medium text-primary-strong hover:bg-muted">
            All bookings
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  icon: Icon,
  title,
  group,
  onNavigate,
  tone = "text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  group: { count: number; items: NotificationItem[] };
  onNavigate: () => void;
  tone?: string;
}) {
  if (group.count === 0) return null;
  const more = group.count - group.items.length;
  return (
    <section className="border-b py-2 last:border-b-0">
      <h3 className="eyebrow flex items-center justify-between px-4 py-1 text-muted-foreground">
        {title}
        <span className="tabular-nums">{group.count}</span>
      </h3>
      <ul>
        {group.items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} onClick={onNavigate} className="flex gap-3 px-4 py-2 hover:bg-muted">
              <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{ago(item.at)}</span>
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{item.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="px-4 pt-1 text-xs text-muted-foreground">and {more} more</p>}
    </section>
  );
}

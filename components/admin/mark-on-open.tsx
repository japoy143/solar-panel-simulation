"use client";

import { useEffect } from "react";

/** Fired after something that changes the bell's counts, so it refetches straight away. */
export const NOTIFICATIONS_CHANGED = "admin:notifications-changed";

/**
 * Runs a (bound) Server Action once when the page opens, e.g. marking a booking as seen or a
 * conversation as read, then tells the notification bell to refresh.
 */
export function MarkOnOpen({ action }: { action: () => Promise<void> }) {
  useEffect(() => {
    action()
      .then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)))
      .catch((err) => console.error("mark-on-open failed", err));
  }, [action]);
  return null;
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { FLASH_COOKIE, parseFlash } from "@/lib/flash";

function readFlashCookie() {
  const entry = document.cookie.split("; ").find((c) => c.startsWith(`${FLASH_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(FLASH_COOKIE.length + 1)) : undefined;
}

/**
 * Shows a toast queued by setFlash() (lib/server/flash.ts) once, after the redirect that
 * follows it, then deletes the cookie. Re-checks on every navigation, since a Server Action
 * redirect is a client-side navigation that keeps this component mounted.
 * Reads the URL, so render it inside <Suspense>.
 */
export function FlashToast() {
  const pathname = usePathname();
  useEffect(() => {
    const flash = parseFlash(readFlashCookie());
    if (!flash) return;
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
    toast[flash.type](flash.message, { description: flash.description });
  }, [pathname]);
  return null;
}

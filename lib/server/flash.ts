import "server-only";
import { cookies } from "next/headers";
import { FLASH_COOKIE, type Flash } from "@/lib/flash";

/**
 * Queues a toast for the next page, e.g. right before redirect() in a Server Action.
 * Readable by the browser (not httpOnly) because <FlashToast> reads and clears it there; it
 * only ever holds a short UI message, and expires after 30 s if nothing shows it.
 */
export async function setFlash(flash: Flash) {
  (await cookies()).set(FLASH_COOKIE, JSON.stringify(flash), {
    path: "/",
    maxAge: 30,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}

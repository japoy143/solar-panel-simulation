// "Flash" toasts: a Server Action that ends in redirect() (sign in, sign out…) can't return a
// result for the page to toast, because the page that called it is replaced. Instead the action
// sets this short-lived cookie, and <FlashToast> (components/flash-toast.tsx) shows it once on
// the page it redirected to, then deletes it.

export const FLASH_COOKIE = "flash";

export type Flash = {
  type: "success" | "info" | "error";
  message: string;
  description?: string;
};

export function parseFlash(raw: string | undefined): Flash | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as Partial<Flash>;
    if ((f.type === "success" || f.type === "info" || f.type === "error") && typeof f.message === "string") {
      return {
        type: f.type,
        message: f.message.slice(0, 200),
        description: typeof f.description === "string" ? f.description.slice(0, 300) : undefined,
      };
    }
  } catch {
    // Malformed: ignore.
  }
  return null;
}

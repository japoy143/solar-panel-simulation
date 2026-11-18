"use client";

import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import { CircleAlertIcon, Trash2Icon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" styles the confirm button red and shows a trash icon. */
  variant?: "default" | "destructive";
  icon?: LucideIcon;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * App-wide replacement for `window.confirm`. Mount once (root layout), then:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete?", variant: "destructive" })) …
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback<Confirm>((next) => {
    resolver.current?.(false); // a newer request replaces any pending one
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const destructive = options?.variant === "destructive";
  const Icon = options?.icon ?? (destructive ? Trash2Icon : CircleAlertIcon);

  return (
    <ConfirmContext value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(next) => !next && settle(false)}>
        {/* Options stay set while closing so the exit animation keeps its content. */}
        {options && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia
                className={cn(destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}
              >
                <Icon />
              </AlertDialogMedia>
              <AlertDialogTitle className="font-semibold">{options.title}</AlertDialogTitle>
              {options.description && <AlertDialogDescription>{options.description}</AlertDialogDescription>}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-9">{options.cancelLabel ?? "Cancel"}</AlertDialogCancel>
              <AlertDialogAction
                autoFocus
                className="h-9"
                variant={destructive ? "destructive" : "default"}
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext>
  );
}

export function useConfirm() {
  const confirm = use(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

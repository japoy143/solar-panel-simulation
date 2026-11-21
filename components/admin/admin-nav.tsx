"use client";

import { Suspense } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheckIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";
import { logout } from "@/app/admin/(auth)/login/actions";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/products", label: "Products", icon: PackageIcon },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheckIcon },
  { href: "/admin/clients", label: "Clients", icon: UsersIcon },
];

const itemClass =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4";

/** Reads the URL, so it streams in behind Suspense; the fallback is the same menu with no highlight. */
function ActiveMenuLinks({ onNavigate }: { onNavigate?: boolean }) {
  return <MenuLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

function MenuLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: boolean }) {
  return (
    <ul className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          pathname !== null && (href === "/admin" ? pathname === href : pathname.startsWith(href));
        const linkProps = {
          href,
          "aria-current": active ? ("page" as const) : undefined,
          className: cn(itemClass, active && "bg-primary/10 font-medium text-primary-strong"),
        };
        const content = (
          <>
            <Icon />
            {label}
          </>
        );
        return (
          <li key={href}>
            {onNavigate ? (
              <SheetClose render={<Link {...linkProps} />}>{content}</SheetClose>
            ) : (
              <Link {...linkProps}>{content}</Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NavList({ onNavigate }: { onNavigate?: boolean }) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div className="space-y-2">
        <p className="eyebrow px-3 text-muted-foreground">Menu</p>
        <Suspense fallback={<MenuLinks pathname={null} onNavigate={onNavigate} />}>
          <ActiveMenuLinks onNavigate={onNavigate} />
        </Suspense>
      </div>

      <ul className="flex flex-col gap-1 border-t pt-4">
        <li>
          <Link href="/" className={itemClass}>
            <ExternalLinkIcon />
            View site
          </Link>
        </li>
        <li>
          <form action={logout}>
            <SignOutButton />
          </form>
        </li>
      </ul>
    </div>
  );
}

/** Shows progress while the sign-out action runs; the "Signed out" toast follows the redirect. */
function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(itemClass, "w-full disabled:opacity-60")}>
      {pending ? <Loader2Icon className="animate-spin" /> : <LogOutIcon />}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <Logo href="/admin" />
      <Badge variant="secondary">Admin</Badge>
    </div>
  );
}

export function AdminSidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh flex-col gap-8 border-r bg-muted/40 p-4 md:flex">
      <div className="px-2 pt-2">
        <Brand />
      </div>
      <nav aria-label="Admin" className="flex flex-1 flex-col">
        <NavList />
      </nav>
    </aside>
  );
}

export function AdminMobileBar() {
  return (
    <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:hidden">
      <Brand />
      <Sheet>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" aria-label="Open menu" />}
        >
          <MenuIcon />
        </SheetTrigger>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>
              <Brand />
            </SheetTitle>
          </SheetHeader>
          <nav aria-label="Admin mobile" className="flex flex-1 flex-col px-4 pb-4">
            <NavList onNavigate />
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

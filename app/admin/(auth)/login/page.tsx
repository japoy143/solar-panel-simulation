import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/site/logo";
import { LoginForm } from "@/components/admin/login-form";

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-linear-to-b from-primary/10 to-background px-4 py-16">
      <Logo />

      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="eyebrow text-primary-strong">Admin</p>
          <CardTitle className="text-2xl font-semibold">Sign in</CardTitle>
          <CardDescription>Admin access to bookings and products.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>

      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to site
      </Link>
    </main>
  );
}

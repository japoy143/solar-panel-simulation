"use client";

import { startTransition, useActionState, useEffect } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { login, type LoginState } from "@/app/admin/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: LoginState = { error: null, submittedAt: 0 };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  useEffect(() => {
    if (state.error) toast.error("Couldn't sign in", { description: state.error });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per submission
  }, [state.submittedAt]);

  return (
    <form
      noValidate
      // Manual submit so a failed attempt keeps the typed email (form actions auto-reset).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-5"
    >
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          className="h-10"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={state.error ? true : undefined}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          className="h-10"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
        />
      </div>
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

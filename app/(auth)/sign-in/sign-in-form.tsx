"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signInAction,
    undefined,
  );
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-xl font-semibold tracking-tight text-fg">
        Connexion
      </h1>
      <p className="mt-1.5 mb-6 text-[13px] text-faint">
        Bon retour parmi nous. Votre plaidoyer vous attend.
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="vous@organisation.org"
            required
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        {state?.error && (
          <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-faint">
        Pas encore de compte ?{" "}
        <Link href="/sign-up" className="text-indigo-700 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-300">
          Créer une organisation
        </Link>
      </p>
      <div className="mt-6 rounded-lg border border-line bg-hover p-3 text-[12px] leading-relaxed text-faint">
        <span className="font-medium text-faint">Comptes démo</span> (mot de
        passe : <code className="text-faint">password123</code>) —{" "}
        <span className="text-faint">admin@actyl.org</span>,{" "}
        <span className="text-faint">campagne@actyl.org</span>…
      </div>
    </div>
  );
}

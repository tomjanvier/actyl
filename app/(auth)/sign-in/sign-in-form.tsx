"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";

const ACT_ERRORS: Record<string, string> = {
  act_denied: "Connexion Act refusée.",
  act_state: "Session de connexion expirée, veuillez réessayer.",
  act_token: "Échange avec Act impossible, veuillez réessayer.",
  act_identity: "Identité Act incomplète ou non vérifiée.",
  act_unreachable: "Act injoignable pour le moment.",
  act_unconfigured: "Connexion Act non configurée.",
  act_failed: "Création de la session impossible.",
};

export function SignInForm({
  next,
  actError,
  actSsoEnabled,
}: {
  next?: string;
  actError?: string;
  actSsoEnabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signInAction,
    undefined,
  );
  const actStartHref = next ? `/api/auth/act/start?next=${encodeURIComponent(next)}` : "/api/auth/act/start";
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-xl font-semibold tracking-tight text-fg">
        Connexion
      </h1>
      <p className="mt-1.5 mb-6 text-[13px] text-faint">
        Bon retour parmi nous. Votre plaidoyer vous attend.
      </p>
      {actSsoEnabled && (
        <div className="flex flex-col gap-2">
          <a
            href={actStartHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13.5px] font-medium ring-1 ring-inset ring-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20"
          >
            <span aria-hidden="true">◉</span> Se connecter avec Act
          </a>
          {actError && ACT_ERRORS[actError] && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20">
              {ACT_ERRORS[actError]}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11.5px] text-faint" aria-hidden="true">
            <span className="h-px flex-1 bg-current opacity-20" />
            <span>ou par mot de passe</span>
            <span className="h-px flex-1 bg-current opacity-20" />
          </div>
        </div>
      )}
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
    </div>
  );
}

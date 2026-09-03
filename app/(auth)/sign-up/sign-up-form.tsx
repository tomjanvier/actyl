"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";
import { TurnstileWidget } from "@/components/security/turnstile-widget";

export function SignUpForm({ mode }: { mode: "OPEN" | "APPROVAL" }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signUpAction,
    undefined,
  );

  if (state?.pending) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-5 text-center">
        <p className="text-[28px]">🙏</p>
        <h1 className="mt-2 text-[16px] font-semibold text-zinc-50">
          Demande envoyée !
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
          Votre demande de compte est en attente de validation par l&apos;équipe
          PLAID·ACT. Vous recevrez une réponse à l&apos;adresse indiquée dès
          que votre compte sera activé.
        </p>
        <Link href="/sign-in" className="mt-4 inline-block text-[13px] text-indigo-400 hover:text-indigo-300">
          Retour à la connexion
        </Link>
      </div>
    );
  }
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-xl font-semibold tracking-tight text-fg">
        Créer votre espace
      </h1>
      <p className="mt-1.5 mb-6 text-[13px] text-faint">
        Un espace de travail par organisation. Vous en serez administrateur·rice.
      </p>
      {mode === "APPROVAL" && (
        <p className="mb-1 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2 text-[12px] leading-relaxed text-amber-300">
          Les inscriptions sont actuellement modérées : votre demande sera
          examinée avant l&apos;activation du compte.
        </p>
      )}
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workspaceName">Nom de l&apos;association *</Label>
          <Input
            id="workspaceName"
            name="workspaceName"
            placeholder="Ligue pour le Climat"
            required
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Votre nom</Label>
          <Input id="name" name="name" placeholder="Camille Dupont" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website">Site web</Label>
            <Input id="website" name="website" type="url" placeholder="https://…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" type="tel" placeholder="06 …" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email professionnel</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="camille@ligue-climat.org"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="8 caractères minimum"
            minLength={8}
            required
          />
        </div>
        {state?.error && (
          <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20">
            {state.error}
          </p>
        )}
        <TurnstileWidget />
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending
            ? "Envoi…"
            : mode === "APPROVAL"
              ? "Demander un compte"
              : "Créer mon espace de travail"}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-faint">
        Déjà un compte ?{" "}
        <Link href="/sign-in" className="text-indigo-700 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-300">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUpAction, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";
import { TurnstileWidget } from "@/components/security/turnstile-widget";

const CONTRIBUTION_CHOICES = [
  ["YES", "Oui"],
  ["NO", "Non pour le moment"],
  ["DISCUSS", "À discuter"],
] as const;

export function SignUpForm({ mode }: { mode: "OPEN" | "APPROVAL" }) {
  const [contributionInterest, setContributionInterest] = useState("");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signUpAction,
    undefined,
  );

  if (state?.pending) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-coral-500/20 bg-coral-500/[0.06] p-5 text-center">
        <p className="text-[28px]">🙏</p>
        <h1 className="mt-2 text-[16px] font-semibold text-fg">
          Demande envoyée !
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-mut">
          Votre demande de compte est en attente de validation par l&apos;équipe
          PLAID·ACT. Vous recevrez une réponse à l&apos;adresse indiquée dès
          que votre compte sera activé.
        </p>
        <Link href="/sign-in" className="mt-4 inline-block text-[13px] text-coral-400 hover:text-coral-300">
          Retour à la connexion
        </Link>
      </div>
    );
  }
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-xl font-semibold tracking-tight text-fg">
        Inscription
      </h1>
      <p className="mt-1.5 mb-6 text-[13px] text-faint">
        Un espace de travail par organisation. Vous en serez administrateur·rice.
      </p>
      {mode === "APPROVAL" && (
        <p className="mb-1 rounded-lg border border-amber-700/25 bg-amber-50 px-3 py-3 text-[13px] leading-relaxed text-amber-950 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100">
          Votre demande sera examinée par PLAID·ACT avant l’ouverture de votre espace.
          Vous recevrez une réponse par e-mail.
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
            <Label htmlFor="website">Site web de l&apos;association</Label>
            <Input id="website" name="website" type="url" placeholder="https://…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" type="tel" placeholder="06 …" />
          </div>
        </div>
        <fieldset className="rounded-lg border border-line bg-card p-3">
          <legend className="px-1 text-[12.5px] font-medium text-fg">
            Soutien au développement d’Actyl
          </legend>
          <p className="mb-2 text-[12px] leading-relaxed text-mut">
            À titre indicatif et sans engagement, votre association envisagerait-elle une cotisation mensuelle à PLAID·ACT ?
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12.5px] text-fg">
            {CONTRIBUTION_CHOICES.map(([value, label]) => (
              <label key={value} className="inline-flex min-h-9 items-center gap-2">
                <input
                  type="radio"
                  name="monthlyContributionInterest"
                  value={value}
                  required
                  checked={contributionInterest === value}
                  onChange={() => setContributionInterest(value)}
                  className="accent-coral-700"
                />
                {label}
              </label>
            ))}
          </div>
          {contributionInterest === "YES" && (
            <div className="mt-3 max-w-48">
              <Label htmlFor="monthlyContributionAmount">Montant mensuel envisagé (€)</Label>
              <Input
                id="monthlyContributionAmount"
                name="monthlyContributionAmount"
                type="number"
                min={1}
                max={100000}
                step={1}
                placeholder="Ex. 25"
                required
              />
            </div>
          )}
        </fieldset>
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
              ? "Demander une inscription"
              : "Créer mon espace"}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-faint">
        Déjà un compte ?{" "}
        <Link href="/sign-in" className="text-coral-700 dark:text-coral-400 hover:text-coral-700 dark:text-coral-300">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

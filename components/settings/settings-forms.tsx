"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createCustomFieldAction,
  createGroupAction,
  inviteMemberAction,
  updateProfileAction,
  createWorkspaceAction,
  saveLandingPageSettingsAction,
  setSegmentFlagAction,
  setNewsletterModuleAction,
} from "@/app/actions/settings";
import { CUSTOM_FIELD_TYPES, CUSTOM_FIELD_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";
import { EntityAvatar } from "@/components/ui/badge";

export function LandingSettingsForm({
  settings,
}: {
  settings: {
    heroTitle: string;
    heroHighlight: string;
    heroText: string;
    primaryCta: string;
    primaryHref: string;
    footerText: string;
  };
}) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean } | undefined,
    FormData
  >(saveLandingPageSettingsAction, undefined);

  useEffect(() => {
    if (state?.ok) toast.success("Page publique enregistrée");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="mt-6 rounded-xl border border-line bg-card p-4">
      <h2 className="text-[14px] font-semibold text-fg">Page publique</h2>
      <p className="mt-1 text-[11.5px] text-faint">
        Ce contenu est commun à tous les espaces et modifiable uniquement par le super-administrateur.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Titre principal</Label>
          <Input name="heroTitle" defaultValue={settings.heroTitle} required />
        </div>
        <div>
          <Label>Texte mis en valeur</Label>
          <Input name="heroHighlight" defaultValue={settings.heroHighlight} required />
        </div>
        <div className="sm:col-span-2">
          <Label>Texte d’introduction</Label>
          <Textarea name="heroText" defaultValue={settings.heroText} required />
        </div>
        <div>
          <Label>Libellé du bouton</Label>
          <Input name="primaryCta" defaultValue={settings.primaryCta} required />
        </div>
        <div>
          <Label>Lien du bouton</Label>
          <Input name="primaryHref" defaultValue={settings.primaryHref} required />
        </div>
        <div className="sm:col-span-2">
          <Label>Pied de page</Label>
          <Input name="footerText" defaultValue={settings.footerText} required />
        </div>
      </div>
      <Button type="submit" size="sm" className="mt-4" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Enregistrement…" : "Enregistrer la page publique"}
      </Button>
    </form>
  );
}

export function CreateWorkspaceForm({ onCreated }: { onCreated: () => void }) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean } | undefined,
    FormData
  >(createWorkspaceAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Espace créé et ajouté au sélecteur");
      onCreated();
    }
    if (state?.error) toast.error(state.error);
  }, [state, onCreated]);

  return (
    <form action={action} className="h-fit rounded-xl border border-line bg-card p-4">
      <h2 className="text-[14px] font-semibold text-fg">Créer un espace</h2>
      <p className="mt-1 text-[11.5px] text-faint">
        Vous serez automatiquement administrateur du nouvel espace.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <Label>Nom de l’espace *</Label>
          <Input name="name" required placeholder="Association ou campagne" />
        </div>
        <div>
          <Label>Site web</Label>
          <Input name="website" type="url" placeholder="https://…" />
        </div>
      </div>
      <Button type="submit" size="sm" className="mt-4" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus />}
        {pending ? "Création…" : "Créer l’espace"}
      </Button>
    </form>
  );
}

export function ModulesCard({
  segments,
  newsletterEnabled,
  newsletterConfigured,
  isAdmin,
  onChanged,
}: {
  segments: { decisionMaker: boolean; members: boolean; volunteers: boolean; donors: boolean; supporters: boolean };
  newsletterEnabled: boolean;
  newsletterConfigured: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const segmentLabels = [
    ["members", "Adhérent·e·s"],
    ["volunteers", "Bénévoles"],
    ["donors", "Donateur·ice·s"],
    ["supporters", "Soutiens"],
  ] as const;

  async function toggleSegment(segment: (typeof segmentLabels)[number][0]) {
    if (!isAdmin) return;
    setBusy(segment);
    await setSegmentFlagAction(segment, !segments[segment]);
    setBusy(null);
    onChanged();
  }

  async function toggleNewsletter() {
    if (!isAdmin) return;
    setBusy("newsletter");
    try {
      await setNewsletterModuleAction(!newsletterEnabled);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Modification impossible");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl overflow-hidden rounded-xl border border-line bg-card">
      <div className="border-b border-line p-5">
        <h2 className="text-[15px] font-semibold text-fg">Modules de l’espace</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-mut">
          Activez uniquement les briques utiles à votre équipe. Les décideurs restent toujours visibles.
        </p>
      </div>
      <div className="divide-y divide-line">
        <div className="p-5">
          <p className="text-[13px] font-semibold text-fg">Champs personnalisés & annuaire</p>
          <p className="mt-1 text-[12px] text-faint">Le schéma de contact commun reste disponible pour tous les espaces.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex min-h-11 items-center justify-between rounded-lg border border-line bg-elev/30 px-3 text-[12.5px] text-mut">
              Décideur·e·ses
              <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-300">
                Toujours actif
              </span>
            </div>
            {segmentLabels.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={segments[key]}
                disabled={!isAdmin || busy !== null}
                onClick={() => void toggleSegment(key)}
                className="flex min-h-11 items-center justify-between rounded-lg border border-line px-3 text-left text-[12.5px] text-mut hover:bg-hover disabled:opacity-50"
              >
                {label}
                <span className={cn("h-5 w-9 rounded-full p-0.5 transition-colors", segments[key] ? "bg-coral-600" : "bg-elev ring-1 ring-inset ring-line")}>
                  <span className={cn("block size-4 rounded-full bg-white transition-transform", segments[key] ? "translate-x-4" : "translate-x-0")} />
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-h-16 items-center justify-between gap-4 p-5">
          <div>
            <p className="text-[13px] font-semibold text-fg">Newsletter / EmailOctopus</p>
            <p className="mt-1 text-[12px] text-faint">
              {newsletterConfigured ? "Connexion configurée." : "Configurez d’abord la clé API et la liste."}
            </p>
          </div>
          <Button variant={newsletterEnabled ? "default" : "outline"} size="sm" disabled={!isAdmin || busy !== null || (!newsletterConfigured && !newsletterEnabled)} onClick={() => void toggleNewsletter()}>
            {busy === "newsletter" ? <Loader2 className="animate-spin" /> : newsletterEnabled ? "Activée" : "Activer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Création d'un champ personnalisé ─────────────────────────────────────────

export function CreateFieldForm({ onCreated }: { onCreated: () => void }) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean } | undefined,
    FormData
  >(createCustomFieldAction, undefined);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Champ ajouté");
      onCreated();
    }
    if (state?.error) toast.error(state.error);
  }, [state, onCreated]);

  return (
    <form
      action={action}
      className="h-fit rounded-xl border border-dashed border-line bg-card p-4"
    >
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg">
        <Plus className="size-4 text-coral-700 dark:text-coral-400" /> Nouveau champ personnalisé
      </h3>
      <Label className="mb-1 block">Libellé *</Label>
      <Input name="label" placeholder="Commission parlementaire" required className="mb-3" />
      <Label className="mb-1 block">Type *</Label>
      <select
        name="type"
        defaultValue="TEXT"
        className="mb-3 h-9 w-full rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-fg outline-none [&>option]:bg-raised"
      >
        {CUSTOM_FIELD_TYPES.map((t) => (
          <option key={t} value={t}>{CUSTOM_FIELD_TYPE_LABELS[t]}</option>
        ))}
      </select>
      <Label className="mb-1 block">Options (pour listes, séparées par virgule)</Label>
      <Textarea name="options" rows={2} placeholder="Option A, Option B, Option C" className="mb-3" />
      <Button type="submit" size="sm" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <Plus />}
        Ajouter le champ
      </Button>
    </form>
  );
}

// ── Création d'un groupe ─────────────────────────────────────────────────────

export function CreateGroupForm({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean } | undefined,
    FormData
  >(createGroupAction, undefined);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Équipe créée");
      onCreated();
    }
    if (state?.error) toast.error(state.error);
  }, [state, onCreated]);

  return (
    <form
      action={action}
      className="h-fit rounded-xl border border-dashed border-line bg-card p-4"
    >
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg">
        <Plus className="size-4 text-coral-700 dark:text-coral-400" /> Nouvelle équipe
      </h3>
      <Label className="mb-1 block">Nom *</Label>
      <Input name="name" placeholder="Cellule Européenne" required className="mb-3" />
      <Label className="mb-1 block">Description</Label>
      <Input name="description" placeholder="Parlement européen et Commission…" className="mb-3" />
      <Label className="mb-1 block">Couleur</Label>
      <select
        name="color"
        defaultValue="indigo"
        className="mb-3 h-9 w-full rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-fg outline-none [&>option]:bg-raised"
      >
        {Object.keys(GROUP_DOT).map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <Plus />}
        Créer l&apos;équipe
      </Button>
      <p className="mt-2 text-center text-[11px] text-faint">
        Les membres s&apos;ajoutent depuis la carte de l&apos;équipe après création.
      </p>
    </form>
  );
}

// ── Invitation d'un membre ───────────────────────────────────────────────────

export function InviteMemberForm({ onInvited }: { onInvited: () => void }) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean } | undefined,
    FormData
  >(inviteMemberAction, undefined);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Membre invité dans l'espace");
      onInvited();
    }
    if (state?.error) toast.error(state.error);
  }, [state, onInvited]);

  return (
    <form
      action={action}
      className="rounded-xl border border-dashed border-line bg-card p-4"
    >
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg">
        <UserPlus className="size-4 text-coral-700 dark:text-coral-400" /> Inviter un membre
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1 block">Email *</Label>
          <Input name="email" type="email" required />
        </div>
        <div>
          <Label className="mb-1 block">Nom *</Label>
          <Input name="name" required />
        </div>
        <div>
          <Label className="mb-1 block">Mot de passe provisoire *</Label>
          <Input name="password" minLength={8} required placeholder="8 caractères min." />
        </div>
        <div>
          <Label className="mb-1 block">Rôle</Label>
          <select
            name="role"
            defaultValue="MEMBER"
            className="h-9 w-full rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-fg outline-none [&>option]:bg-raised"
          >
            <option value="ADMIN">Admin</option>
            <option value="CAMPAIGNER">Responsable campagne</option>
            <option value="MEMBER">Militant·e</option>
            <option value="OBSERVER">Observateur·rice</option>
          </select>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending} className="mt-3 w-full">
        {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
        Ajouter au workspace
      </Button>
      <p className="mt-2 text-center text-[11px] text-faint">
        Transmettez les identifiants manuellement (pas d&apos;email automatique en démo).
      </p>
    </form>
  );
}

// ── Profil ───────────────────────────────────────────────────────────────────

export function ProfileForm({
  user,
}: {
  user: { id: string; name: string; email: string; jobTitle: string | null };
}) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean } | undefined,
    FormData
  >(updateProfileAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Profil mis à jour");
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state, router]);

  return (
    <form action={action} className="max-w-md rounded-xl border border-line bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <EntityAvatar name={user.name} color="indigo" size="lg" />
        <div>
          <p className="text-[14px] font-semibold text-fg">{user.name}</p>
          <p className="text-[12px] text-faint">{user.email}</p>
        </div>
      </div>
      <Label className="mb-1 block">Nom affiché</Label>
      <Input name="name" defaultValue={user.name} className="mb-3" required />
      <Label className="mb-1 block">Fonction</Label>
      <Input name="jobTitle" defaultValue={user.jobTitle ?? ""} placeholder="Chargée de plaidoyer…" className="mb-3" />
      <details className="mb-3 rounded-lg border border-line p-3">
        <summary className="cursor-pointer text-[12.5px] text-mut">
          Changer de mot de passe
        </summary>
        <Label className="mb-1 mt-3 block">Mot de passe actuel</Label>
        <Input name="currentPassword" type="password" className="mb-2" autoComplete="current-password" />
        <Label className="mb-1 block">Nouveau mot de passe</Label>
        <Input name="newPassword" type="password" minLength={8} autoComplete="new-password" />
      </details>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}

export const GROUP_DOT: Record<string, string> = {
  indigo: "bg-coral-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

// ── Référentiels partagés et imports indépendants ─────────────────────────────


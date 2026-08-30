"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  UsersRound,
  ShieldCheck,
  Plus,
  Trash2,
  UserPlus,
  KeyRound,
  Loader2,
  Download,
  Plug,
  Copy,
  Mail,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import type { Role } from "@/lib/constants";
import {
  createCustomFieldAction,
  deleteCustomFieldAction,
  createGroupAction,
  deleteGroupAction,
  updateMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
  removeGroupMemberAction,
  updateProfileAction,
} from "@/app/actions/settings";
import {
  importOfficialSourceAction,
  installReferencePackAction,
  setReferencePackEnabledAction,
} from "@/app/actions/import";
import {
  setSignupModeAction,
  approveAccountRequestAction,
  rejectAccountRequestAction,
  setSegmentFlagAction,
  setNewsletterModuleAction,
  saveNewsletterSettingsAction,
  fetchNewsletterListsAction,
} from "@/app/actions/settings";
import { CUSTOM_FIELD_TYPES, CUSTOM_FIELD_TYPE_LABELS, type CustomFieldType } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";
import { EntityAvatar } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/controls";
import { ImportTeamDialog } from "@/components/contacts/import-team-dialog";
import type { ReferencePackKey } from "@/lib/datasets/reference-packs";

type ReferenceSource =
  | "an"
  | "senat"
  | "pe"
  | "presidentielle"
  | "paris"
  | "regions"
  | "departements";

type RoleMeta = Record<
  string,
  { label: string; description: string; badge: string }
>;

export function SettingsView({
  initialTab,
  role,
  isAdmin,
  canImportContacts,
  currentUserId,
  currentUser,
  fields,
  groups,
  members,
  roleMeta,
  canManageGroups,
  signupMode,
  pendingRequests,
  apiTokens,
  segments,
  referencePacks,
  newsletter,
}: {
  initialTab: string | null;
  role: string;
  isAdmin: boolean;
  canImportContacts: boolean;
  currentUserId: string;
  currentUser: { id: string; name: string; email: string; jobTitle: string | null };
  fields: Array<{
    id: string;
    label: string;
    type: string;
    options: string | null;
    showInTable: boolean;
  }>;
  groups: Array<{
    id: string;
    name: string;
    description: string | null;
    color: string;
    campaignCount: number;
    members: Array<{ groupMemberId: string; name: string; email: string }>;
  }>;
  members: Array<{
    membershipId: string;
    userId: string;
    name: string;
    email: string;
    jobTitle: string | null;
    role: Role;
    groups: string[];
  }>;
  roleMeta: RoleMeta;
  canManageGroups: boolean;
  signupMode: "OPEN" | "APPROVAL";
  pendingRequests: Array<{
    id: string;
    name: string;
    email: string;
    orgName: string;
    website: string | null;
    phone: string | null;
    createdAt: string;
  }>;
  apiTokens: Array<{
    id: string;
    name: string;
    prefix: string;
    revoked: boolean;
    lastUsedAt: string | null;
    createdAt: string;
  }>;
  segments: { decisionMaker: boolean; members: boolean; volunteers: boolean; donors: boolean; supporters: boolean };
  referencePacks: Array<{
    key: ReferencePackKey;
    name: string;
    description: string;
    expected: string;
    source: ReferenceSource;
    installed: boolean;
    enabled: boolean;
  }>;
  newsletter: {
    enabled: boolean;
    apiKeyMasked: string | null;
    listId: string;
  };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState(initialTab === "profil" ? "profil" : initialTab ?? "modules");

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  return (
    <div className="px-6 py-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="modules"><SlidersHorizontal /> Modules</TabsTrigger>
          <TabsTrigger value="equipes"><UsersRound /> Équipes</TabsTrigger>
          <TabsTrigger value="membres"><ShieldCheck /> Membres & accès</TabsTrigger>
          <TabsTrigger value="import"><Download /> Référentiels & imports</TabsTrigger>
          <TabsTrigger value="api"><Plug /> API & intégrations</TabsTrigger>
          <TabsTrigger value="profil"><KeyRound /> Mon profil</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="mt-5 space-y-6 outline-none">
          <ModulesCard
            segments={segments}
            newsletterEnabled={newsletter.enabled}
            newsletterConfigured={!!newsletter.apiKeyMasked && !!newsletter.listId}
            isAdmin={isAdmin}
            onChanged={refresh}
          />
          <NewsletterCard
            enabled={newsletter.enabled}
            apiKeyMasked={newsletter.apiKeyMasked}
            listId={newsletter.listId}
            isAdmin={isAdmin}
            onChanged={refresh}
          />
          <div>
            <h2 className="mb-3 text-[15px] font-semibold text-fg">Champs personnalisés</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="flex h-10 items-center justify-between border-b border-line px-4">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                  Schéma de l&#39;espace ({fields.length})
                </span>
                {!isAdmin && (
                  <span className="text-[11px] text-faint">lecture seule — admin requis</span>
                )}
              </div>
              {fields.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-faint">
                  Aucun champ personnalisé. Ajoutez-en pour enrichir vos fiches décideurs.
                </p>
              ) : (
                fields.map((f) => (
                  <div
                    key={f.id}
                    className="group flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-fg">{f.label}</p>
                      <p className="truncate text-[11px] text-faint">
                        {CUSTOM_FIELD_TYPE_LABELS[f.type as CustomFieldType] ?? f.type}
                        {f.options &&
                          ` · ${JSON.parse(f.options).length} options · ${JSON.parse(f.options).slice(0, 3).join(", ")}…`}
                      </p>
                    </div>
                    {f.showInTable && (
                      <span className="rounded bg-elev px-1.5 py-0.5 text-[10px] text-faint">
                        colonne
                      </span>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          if (!confirm(`Supprimer le champ « ${f.label} » et toutes ses valeurs ?`)) return;
                          void deleteCustomFieldAction(f.id).then(refresh);
                        }}
                        className="invisible text-faint hover:text-rose-700 dark:text-rose-400 group-hover:visible"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {isAdmin && <CreateFieldForm onCreated={refresh} />}
          </div>
          </div>
        </TabsContent>

        {/* ── Groupes ── */}
        <TabsContent value="equipes" className="mt-5 outline-none">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {groups.map((g) => (
                <article
                  key={g.id}
                  className="rounded-xl border border-line bg-card p-4"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
                      <span className={cn("size-2.5 rounded-full", GROUP_DOT[g.color] ?? "bg-indigo-500")} />
                      {g.name}
                    </h3>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          if (!confirm(`Supprimer l'équipe « ${g.name} » ?`)) return;
                          void deleteGroupAction(g.id).then(refresh);
                        }}
                        className="invisible text-faint hover:text-rose-700 dark:text-rose-400 group-hover:visible"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                  {g.description && (
                    <p className="mt-1 text-[12px] leading-relaxed text-faint">{g.description}</p>
                  )}
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {g.members.map((m) => (
                      <li key={m.groupMemberId} className="flex items-center gap-2">
                        <EntityAvatar name={m.name} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-mut">
                          {m.name}
                          <span className="block text-[10.5px] text-faint">{m.email}</span>
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => void removeGroupMemberAction(m.groupMemberId).then(refresh)}
                            title="Retirer de l'équipe"
                            className="text-faint hover:text-rose-700 dark:text-rose-400"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                    {g.members.length === 0 && (
                      <li className="text-[12px] text-faint">Aucun membre.</li>
                    )}
                  </ul>
                  <footer className="mt-3 border-t border-line pt-2 text-[11px] text-faint">
                    {g.campaignCount} campagne{g.campaignCount > 1 ? "s" : ""} liée
                    {g.campaignCount > 1 ? "s" : ""}
                  </footer>
                </article>
              ))}
              {groups.length === 0 && (
                <p className="col-span-full rounded-xl border border-dashed border-line px-6 py-12 text-center text-[13px] text-faint">
                  Aucune équipe — créez des groupes (« Équipe Lobby Paris », « Taskforce Bénévoles »…).
                </p>
              )}
            </div>

            {canManageGroups && <CreateGroupForm onCreated={refresh} />}
          </div>
        </TabsContent>

        {/* ── Membres ── */}
        <TabsContent value="membres" className="mt-5 outline-none">
          <AccountRequestsSection
            isAdmin={isAdmin}
            signupMode={signupMode}
            pending={pendingRequests}
            onChanged={refresh}
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <div className="overflow-hidden rounded-xl border border-line">
              {members.map((m) => (
                <div
                  key={m.membershipId}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0"
                >
                  <EntityAvatar name={m.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-fg">
                      {m.name}
                      {m.userId === currentUserId && (
                        <span className="ml-1.5 text-[10.5px] text-indigo-700 dark:text-indigo-400">vous</span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-faint">
                      {m.email}
                      {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                    </p>
                    {m.groups.length > 0 && (
                      <p className="mt-0.5 truncate text-[10.5px] text-faint">
                        {m.groups.join(" · ")}
                      </p>
                    )}
                  </div>
                  {isAdmin && m.userId !== currentUserId ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        value={m.role}
                        onChange={(e) => {
                          void updateMemberRoleAction(
                            m.membershipId,
                            e.target.value as Role,
                          ).then((r) => {
                            if (r?.error) toast.error(r.error);
                            else toast.success("Rôle mis à jour");
                            refresh();
                          });
                        }}
                        className="h-8 rounded-lg border border-line bg-elev px-2 text-[12px] text-fg outline-none [&>option]:bg-raised"
                      >
                        {(Object.keys(roleMeta) as Role[]).map((r) => (
                          <option key={r} value={r}>{roleMeta[r]!.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (!confirm(`Retirer ${m.name} de cet espace ?`)) return;
                          void removeMemberAction(m.membershipId)
                            .then(() => {
                              toast.success("Membre retiré");
                              refresh();
                            })
                            .catch((e: Error) => toast.error(e.message));
                        }}
                        className="text-faint hover:text-rose-700 dark:text-rose-400"
                        title="Retirer de l'espace"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", roleMeta[m.role]?.badge)}>
                      {roleMeta[m.role]?.label ?? m.role}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              {isAdmin && <InviteMemberForm onInvited={refresh} />}
              {/* Légende des rôles. */}
              <section className="rounded-xl border border-line bg-card p-4">
                <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-faint">
                  Matrice des rôles
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {(Object.keys(roleMeta) as Role[]).map((r) => (
                    <li key={r}>
                      <p className="flex items-center gap-2 text-[12.5px] font-medium text-fg">
                        <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] ring-1 ring-inset", roleMeta[r]!.badge)}>
                          {roleMeta[r]!.label}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-faint">
                        {roleMeta[r]!.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
          {!isAdmin && (
            <p className="mt-4 text-[12px] text-faint">
              Votre rôle actuel :{" "}
              <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", roleMeta[role]?.badge)}>
                {roleMeta[role]?.label ?? role}
              </span>{" "}
              — seul un administrateur peut gérer les accès.
            </p>
          )}
        </TabsContent>

        {/* ── Import des élus ── */}
        <TabsContent value="import" className="mt-5 outline-none">
          <ImportOfficials
            isAdmin={isAdmin}
            canImportContacts={canImportContacts}
            referencePacks={referencePacks}
          />
        </TabsContent>

        {/* ── API et intégrations ── */}
        <TabsContent value="api" className="mt-5 outline-none">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <ApiTokensCard tokens={apiTokens} isAdmin={isAdmin} onChanged={refresh} />
          </div>
        </TabsContent>

        {/* ── Profil ── */}
        <TabsContent value="profil" className="mt-5 outline-none">
          <ProfileForm user={currentUser} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModulesCard({
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
                <span className={cn("h-5 w-9 rounded-full p-0.5 transition-colors", segments[key] ? "bg-indigo-600" : "bg-elev ring-1 ring-inset ring-line")}>
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

function CreateFieldForm({ onCreated }: { onCreated: () => void }) {
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
        <Plus className="size-4 text-indigo-700 dark:text-indigo-400" /> Nouveau champ personnalisé
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

function CreateGroupForm({
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
        <Plus className="size-4 text-indigo-700 dark:text-indigo-400" /> Nouvelle équipe
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

function InviteMemberForm({ onInvited }: { onInvited: () => void }) {
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
        <UserPlus className="size-4 text-indigo-700 dark:text-indigo-400" /> Inviter un membre
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

function ProfileForm({
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

const GROUP_DOT: Record<string, string> = {
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

// ── Référentiels partagés et imports indépendants ─────────────────────────────

function ImportOfficials({
  isAdmin,
  canImportContacts,
  referencePacks,
}: {
  isAdmin: boolean;
  canImportContacts: boolean;
  referencePacks: Array<{
    key: ReferencePackKey;
    name: string;
    description: string;
    expected: string;
    source: ReferenceSource;
    installed: boolean;
    enabled: boolean;
  }>;
}) {
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});
  const [teamOpen, setTeamOpen] = useState(false);
  const router = useRouter();

  async function importIntoDirectory(
    key: ReferencePackKey,
    source: ReferenceSource,
  ) {
    if (!canImportContacts || running) return;
    const operation = `directory:${key}`;
    setRunning(operation);
    setResult((current) => ({ ...current, [operation]: "" }));
    const res = await importOfficialSourceAction(source);
    setRunning(null);
    if (res.ok) {
      setResult((current) => ({
        ...current,
        [operation]: `${res.created ?? 0} créé(s) · ${res.skipped ?? 0} ignoré(s)`,
      }));
      toast.success("Import indépendant terminé");
      router.refresh();
    } else {
      setResult((current) => ({
        ...current,
        [operation]: res.error ?? "Import impossible",
      }));
      toast.error(res.error ?? "Erreur");
    }
  }

  async function updateSharedPack(
    pack: (typeof referencePacks)[number],
    action: "enable" | "sync" | "disable",
  ) {
    if (!isAdmin || running) return;
    if (
      action === "disable" &&
      !window.confirm(
        `Désactiver « ${pack.name} » dans cet espace ? Les contacts et la liste seront conservés.`,
      )
    ) return;
    const operation = `shared:${pack.key}`;
    setRunning(operation);
    const res =
      action === "sync"
        ? await installReferencePackAction(pack.key)
        : await setReferencePackEnabledAction(pack.key, action === "enable");
    setRunning(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (action === "sync") {
      toast.success(
        res.proposed
          ? `${res.proposed} modification(s) à valider dans les listes`
          : "Référentiel à jour",
      );
    } else {
      toast.success(action === "enable" ? "Référentiel activé" : "Référentiel désactivé");
    }
    router.refresh();
  }

  return (
    <div className="max-w-5xl space-y-6">
      {isAdmin && (
        <section>
          <h2 className="text-[15px] font-semibold text-fg">Listes de référence partagées</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-mut">
            Activez les référentiels utiles à cet espace. La synchronisation hebdomadaire
            propose les écarts ; un administrateur les valide ensuite dans « Listes partagées ».
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {referencePacks.map((pack) => {
              const operation = `shared:${pack.key}`;
              const active = pack.installed && pack.enabled;
              return (
                <article key={pack.key} className="rounded-xl border border-line bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[13.5px] font-semibold text-fg">{pack.name}</h3>
                      <p className="mt-1 text-[12px] text-mut">{pack.description}</p>
                      <p className="mt-1 text-[11px] text-faint">{pack.expected}</p>
                    </div>
                    <span className={cn(
                      "rounded-md px-2 py-1 text-[10.5px] font-medium",
                      active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-elev text-faint",
                    )}>
                      {active ? "Activée" : "Désactivée"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!active ? (
                      <Button size="sm" disabled={running !== null} onClick={() => void updateSharedPack(pack, "enable")}>
                        {running === operation ? <Loader2 className="animate-spin" /> : <Download />}
                        Activer
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" disabled={running !== null} onClick={() => void updateSharedPack(pack, "sync")}>
                          {running === operation ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                          Vérifier les mises à jour
                        </Button>
                        <Button variant="ghost" size="sm" disabled={running !== null} onClick={() => void updateSharedPack(pack, "disable")}>
                          Désactiver
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="border-t border-line pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Import indépendant</h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-mut">
              Ajoutez une copie ponctuelle à votre répertoire si vous ne souhaitez pas utiliser
              une liste partagée. Cet import ne sera pas synchronisé chaque semaine.
            </p>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setTeamOpen(true)}>
              <UsersRound /> Importer une équipe de campagne
            </Button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {referencePacks.map((pack) => {
            const operation = `directory:${pack.key}`;
            return (
              <article key={pack.key} className="flex items-center gap-3 rounded-xl border border-line bg-card p-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold text-fg">{pack.name}</h3>
                  <p className="mt-0.5 text-[11.5px] text-faint">Copie locale sans synchronisation</p>
                  {result[operation] && (
                    <p className="mt-1 text-[11.5px] text-mut">{result[operation]}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canImportContacts || running !== null}
                  onClick={() => void importIntoDirectory(pack.key, pack.source)}
                >
                  {running === operation ? <Loader2 className="animate-spin" /> : <Download />}
                  Importer
                </Button>
              </article>
            );
          })}
        </div>
        {!canImportContacts && (
          <p className="mt-3 text-[12px] text-faint">Votre rôle est en lecture seule.</p>
        )}
      </section>

      {isAdmin && <ImportTeamDialog open={teamOpen} onOpenChange={setTeamOpen} />}
    </div>
  );
}


// ── Demandes de compte et mode d'inscription ─────────────────────────────────

function AccountRequestsSection({
  isAdmin,
  signupMode,
  pending,
  onChanged,
}: {
  isAdmin: boolean;
  signupMode: "OPEN" | "APPROVAL";
  pending: Array<{
    id: string;
    name: string;
    email: string;
    orgName: string;
    website: string | null;
    phone: string | null;
    createdAt: string;
  }>;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState(signupMode);

  async function changeMode(next: "OPEN" | "APPROVAL") {
    setMode(next);
    await setSignupModeAction(next);
    toast.success(
      next === "OPEN"
        ? "Inscriptions ouvertes : création de compte immédiate."
        : "Inscriptions modérées : les demandes doivent être approuvées.",
    );
    onChanged();
  }

  return (
    <section className="mb-5 rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-fg">Accès à la plateforme</h3>
          <p className="mt-0.5 text-[12px] text-mut">
            Contrôlez qui peut créer un espace de travail.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 rounded-lg bg-elev p-1 ring-1 ring-inset ring-line">
            <button
              onClick={() => void changeMode("OPEN")}
              className={cn(
                "rounded-md px-3 py-1 text-[12px] font-medium transition-colors",
                mode === "OPEN" ? "bg-hoverstrong text-fg" : "text-mut hover:text-fg",
              )}
            >
              Ouvert
            </button>
            <button
              onClick={() => void changeMode("APPROVAL")}
              className={cn(
                "rounded-md px-3 py-1 text-[12px] font-medium transition-colors",
                mode === "APPROVAL" ? "bg-hoverstrong text-fg" : "text-mut hover:text-fg",
              )}
            >
              Sur demande
            </button>
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 border-t border-linesoft pt-3">
          <li className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Demandes en attente ({pending.length})
          </li>
          {pending.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-linesoft bg-hover px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">
                  {r.orgName} — {r.name}
                </p>
                <p className="truncate text-[11.5px] text-mut">
                  {r.email}
                  {r.website ? ` · ${r.website}` : ""}
                  {r.phone ? ` · ${r.phone}` : ""}
                </p>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void approveAccountRequestAction(r.id)
                        .then(() => {
                          toast.success(`Compte créé pour ${r.orgName}`);
                          onChanged();
                        })
                        .catch((e: Error) => toast.error(e.message))
                    }
                  >
                    Approuver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void rejectAccountRequestAction(r.id).then(onChanged)
                    }
                  >
                    Refuser
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Tokens API ───────────────────────────────────────────────────────────────

function ApiTokensCard({
  tokens,
  isAdmin,
  onChanged,
}: {
  tokens: Array<{
    id: string;
    name: string;
    prefix: string;
    revoked: boolean;
    lastUsedAt: string | null;
    createdAt: string;
  }>;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const { createApiTokenAction } = await import("@/app/actions/settings");
    const res = await createApiTokenAction({ name });
    setBusy(false);
    if ("ok" in res && res.ok && res.plaintext) {
      setFreshToken(res.plaintext);
      setName("");
      onChanged();
    } else if ("error" in res && res.error) {
      toast.error(res.error);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Révoquer ce token ? Les intégrations qui l'utilisent cesseront de fonctionner.")) return;
    const { revokeApiTokenAction } = await import("@/app/actions/settings");
    await revokeApiTokenAction(id);
    toast.success("Token révoqué");
    onChanged();
  }

  return (
    <div className="rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h3 className="text-[13.5px] font-semibold text-fg">Tokens API</h3>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 border-b border-line bg-elev/40 px-4 py-2.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du token"
            maxLength={60}
          />
          <Button size="sm" disabled={busy || name.trim().length < 2} onClick={() => void create()}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />} Créer
          </Button>
        </div>
      )}

      {freshToken && (
        <div className="border-b border-line bg-indigo-500/[0.06] px-4 py-3">
          <p className="mb-1.5 text-[12px] font-medium text-indigo-700 dark:text-indigo-300">
            Copiez ce token maintenant — il ne sera plus jamais affiché :
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-elev px-2.5 py-1.5 font-mono text-[12px] text-fg ring-1 ring-inset ring-line">
              {freshToken}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(freshToken);
                toast.success("Token copié !");
              }}
            >
              <Copy /> Copier
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setFreshToken(null)}>
              OK
            </Button>
          </div>
        </div>
      )}

      <ul>
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center gap-3 border-b border-linesoft px-4 py-2.5 last:border-0">
            <Plug className={cn("size-4 shrink-0", t.revoked ? "text-faint line-through" : "text-indigo-700 dark:text-indigo-400")} />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[13px] font-medium text-fg", t.revoked && "line-through opacity-50")}>
                {t.name}
              </p>
              <p className="truncate font-mono text-[11px] text-faint">{t.prefix}…</p>
            </div>
            <span className="hidden w-32 shrink-0 text-right text-[11px] text-faint sm:block">
              {t.revoked
                ? "révoqué"
                : t.lastUsedAt
                  ? `utilisé ${timeAgo(t.lastUsedAt)}`
                  : "jamais utilisé"}
            </span>
            {!t.revoked && isAdmin && (
              <button
                onClick={() => void revoke(t.id)}
                title="Révoquer"
                className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-rose-500/10 hover:text-rose-600"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {tokens.length === 0 && (
          <li className="px-4 py-8 text-center text-[12.5px] text-faint">
            Aucun token pour l&apos;instant.
          </li>
        )}
      </ul>
    </div>
  );
}

// ── Module newsletter EmailOctopus ───────────────────────────────────────────

function NewsletterCard({
  enabled,
  apiKeyMasked,
  listId,
  isAdmin,
  onChanged,
}: {
  enabled: boolean;
  apiKeyMasked: string | null;
  listId: string;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [selectedListId, setSelectedListId] = useState(listId);
  const [lists, setLists] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (busy || !isAdmin) return;
    if (!enabled && (!apiKeyMasked || !listId)) {
      toast.error("Renseignez d'abord la clé API et la liste, puis enregistrez.");
      return;
    }
    setBusy(true);
    await setNewsletterModuleAction(!enabled);
    setBusy(false);
    toast.success(enabled ? "Module newsletter désactivé" : "Module newsletter activé");
    onChanged();
  }

  async function loadLists() {
    if (loadingLists) return;
    setLoadingLists(true);
    const res = await fetchNewsletterListsAction({ apiKey });
    setLoadingLists(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if (res.lists) {
      setLists(res.lists);
      if (res.lists.length === 0) toast.info("Aucune liste sur ce compte EmailOctopus.");
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    const res = await saveNewsletterSettingsAction({
      apiKey: apiKey || undefined,
      listId: selectedListId || undefined,
    });
    setSaving(false);
    if ("ok" in res && res.ok) {
      toast.success(
        res.listName
          ? `Connexion enregistrée — liste « ${res.listName} »`
          : "Connexion EmailOctopus enregistrée",
      );
      setApiKey("");
      onChanged();
    } else if ("error" in res && res.error) {
      toast.error(res.error);
    }
  }

  return (
    <div className={cn(
      "max-w-3xl rounded-xl border bg-card transition-colors",
      enabled ? "border-indigo-500/40 ring-1 ring-inset ring-indigo-500/20" : "border-line",
    )}>
      <div className="flex items-start justify-between gap-4 border-b border-line p-5">
        <div className="max-w-xl">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <Mail className="size-4.5 text-sky-600 dark:text-sky-400" />
            Module newsletter — EmailOctopus
            {enabled && (
              <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
                Actif
              </span>
            )}
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mut">
            Suivez l&apos;inscription à la newsletter directement sur les fiches
            contacts et inscrivez plusieurs contacts en un clic depuis le
            répertoire. La synchronisation utilise l&apos;API v2 d&apos;EmailOctopus.
          </p>
        </div>
        {/* Interrupteur principal. */}
        <button
          role="switch"
          aria-checked={enabled}
          disabled={!isAdmin || busy}
          onClick={() => void toggle()}
          title={
            !apiKeyMasked
              ? "Enregistrez d'abord la clé API et la liste"
              : undefined
          }
          className={cn(
            "relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
            enabled ? "bg-indigo-600" : "bg-elev ring-1 ring-inset ring-line",
          )}
        >
          <span
            className={cn(
              "absolute top-1 size-5 rounded-full bg-white shadow transition-all",
              enabled ? "left-6" : "left-1",
            )}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_240px]">
        <div>
          <Label className="mb-1 block">Clé API EmailOctopus</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiKeyMasked ? `Clé enregistrée (${apiKeyMasked}) — laisser vide pour conserver` : "eo_…"}
            autoComplete="off"
          />
          <p className="mt-1 text-[11px] text-faint">
            Créez-la sur emailoctopus.com → Account → Developer → API keys (API v2).
          </p>
        </div>
        <div>
          <Label className="mb-1 block">Liste de diffusion</Label>
          <select
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-fg outline-none [&>option]:bg-raised"
          >
            <option value="">{lists.length ? "Choisir une liste…" : "— charger les listes —"}</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
        <Button variant="outline" size="sm" disabled={!isAdmin || loadingLists} onClick={() => void loadLists()}>
          {loadingLists ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Charger les listes
        </Button>
        <Button size="sm" disabled={!isAdmin || saving || !apiKey.trim() && !!apiKeyMasked && !selectedListId} onClick={() => void save()}>
          {saving ? <Loader2 className="animate-spin" /> : <Plug />}
          Tester & enregistrer
        </Button>
        <span className="ml-auto text-[11px] text-faint">
          Le test valide la clé et la liste avant enregistrement.
        </span>
      </div>

      {!isAdmin && (
        <p className="border-t border-line px-5 py-3 text-[12px] text-faint">
          Seuls les administrateurs peuvent modifier cette intégration.
        </p>
      )}
    </div>
  );
}

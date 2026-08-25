"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
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
  Users,
  Landmark,
  HeartHandshake,
  Gift,
  Megaphone,
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
import { importOfficialSourceAction } from "@/app/actions/import";
import {
  setSignupModeAction,
  approveAccountRequestAction,
  rejectAccountRequestAction,
  setExtendedDirectoryAction,
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

type RoleMeta = Record<
  string,
  { label: string; description: string; badge: string }
>;

export function SettingsView({
  initialTab,
  role,
  isAdmin,
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
  extendedDirectory,
  newsletter,
}: {
  initialTab: string | null;
  role: string;
  isAdmin: boolean;
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
  extendedDirectory: boolean;
  newsletter: {
    enabled: boolean;
    apiKeyMasked: string | null;
    listId: string;
  };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState(initialTab === "profil" ? "profil" : "champs");

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="px-6 py-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="champs"><SlidersHorizontal /> Champs personnalisés</TabsTrigger>
          <TabsTrigger value="annuaire"><Users /> Annuaire étendu</TabsTrigger>
          <TabsTrigger value="newsletter"><Mail /> Newsletter</TabsTrigger>
          <TabsTrigger value="equipes"><UsersRound /> Équipes</TabsTrigger>
          <TabsTrigger value="membres"><ShieldCheck /> Membres & accès</TabsTrigger>
          <TabsTrigger value="import"><Download /> Importer les élus</TabsTrigger>
          <TabsTrigger value="api"><Plug /> API & intégrations</TabsTrigger>
          <TabsTrigger value="profil"><KeyRound /> Mon profil</TabsTrigger>
        </TabsList>

        {/* ── Extended directory ── */}
        <TabsContent value="annuaire" className="mt-5 outline-none">
          <ExtendedDirectoryCard enabled={extendedDirectory} isAdmin={isAdmin} onChanged={refresh} />
        </TabsContent>

        {/* ── Newsletter module ── */}
        <TabsContent value="newsletter" className="mt-5 outline-none">
          <NewsletterCard
            enabled={newsletter.enabled}
            apiKeyMasked={newsletter.apiKeyMasked}
            listId={newsletter.listId}
            isAdmin={isAdmin}
            onChanged={refresh}
          />
        </TabsContent>

        {/* ── Custom fields ── */}
        <TabsContent value="champs" className="mt-5 outline-none">
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
        </TabsContent>

        {/* ── Groups ── */}
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

            {canManageGroups && <CreateGroupForm members={members} onCreated={refresh} />}
          </div>
        </TabsContent>

        {/* ── Members ── */}
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
              {/* Role legend */}
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

        {/* ── Import officials ── */}
        <TabsContent value="import" className="mt-5 outline-none">
          <ImportOfficials isAdmin={isAdmin} />
        </TabsContent>

        {/* ── API & integrations ── */}
        <TabsContent value="api" className="mt-5 outline-none">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <ApiTokensCard tokens={apiTokens} isAdmin={isAdmin} onChanged={refresh} />
            <ApiDocsCard />
          </div>
        </TabsContent>

        {/* ── Profile ── */}
        <TabsContent value="profil" className="mt-5 outline-none">
          <ProfileForm user={currentUser} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Create custom field ─────────────────────────────────────────────────────

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
  }, [state]);

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

// ── Create group + assign members ───────────────────────────────────────────

function CreateGroupForm({
  members,
  onCreated,
}: {
  members: Array<{ membershipId: string; userId: string; name: string; email: string; role: Role; groups: string[] }>;
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
  }, [state]);

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

// ── Invite member ───────────────────────────────────────────────────────────

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
  }, [state]);

  return (
    <form
      action={action}
      className="rounded-xl border border-dashed border-line bg-card p-4"
    >
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg">
        <UserPlus className="size-4 text-indigo-700 dark:text-indigo-400" /> Inviter un membre
      </h3>
      <div className="grid grid-cols-2 gap-3">
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

// ── Profile ─────────────────────────────────────────────────────────────────

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
  }, [state]);

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

// ── Import official directories ─────────────────────────────────────────────

const SOURCES: Array<{
  key: "an" | "senat" | "pe";
  label: string;
  emoji: string;
  description: string;
  detail: string;
}> = [
  {
    key: "an",
    label: "Député·e·s — Assemblée nationale",
    emoji: "🇫🇷",
    description:
      "577 députés en exercice (17ᵉ législature) : groupe politique, circonscription, email.",
    detail: "Source : data.assemblee-nationale.fr (open data officielle)",
  },
  {
    key: "senat",
    label: "Sénateur·rice·s",
    emoji: "🏛️",
    description:
      "348 sénateurs actifs : groupe politique, circonscription, email quand public.",
    detail: "Source : data.senat.fr (OpenSAD)",
  },
  {
    key: "pe",
    label: "Député·e·s européen·ne·s (France)",
    emoji: "🇪🇺",
    description:
      "~81 eurodéputés français (10ᵉ législature) : groupe politique, email. Peut prendre 2–3 min.",
    detail: "Source : data.europarl.europa.eu (API v2)",
  },
];

function ImportOfficials({ isAdmin }: { isAdmin: boolean }) {
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});
  const router = useRouter();

  async function run(key: "an" | "senat" | "pe") {
    if (!isAdmin || running) return;
    setRunning(key);
    setResult((r) => ({ ...r, [key]: "" }));
    const res = await importOfficialSourceAction(key);
    setRunning(null);
    if (res.ok) {
      setResult((r) => ({
        ...r,
        [key]: `✅ ${res.created ?? 0} créés · ${res.already ?? 0} déjà présents (conservés) · ${res.skipped ?? 0} ignorés`,
      }));
      toast.success("Import terminé");
      router.refresh();
    } else {
      setResult((r) => ({ ...r, [key]: `❌ ${res.error}` }));
      toast.error(res.error ?? "Erreur");
    }
  }

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-[13px] leading-relaxed text-mut">
        Importez les annuaires officiels des parlements directement dans votre
        espace. Fusion sans écrasement : les contacts existants (même nom +
        institution) sont conservés tels quels, jamais dupliqués ni modifiés.
      </p>
      <div className="grid grid-cols-1 gap-3">
        {SOURCES.map((s) => (
          <article
            key={s.key}
            className="flex items-center gap-4 rounded-xl border border-line bg-card p-4"
          >
            <span className="text-2xl">{s.emoji}</span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[13.5px] font-semibold text-fg">{s.label}</h3>
              <p className="mt-0.5 text-[12px] leading-relaxed text-mut">{s.description}</p>
              <p className="mt-0.5 text-[11px] text-faint">{s.detail}</p>
              {result[s.key] && (
                <p className="mt-1.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                  {result[s.key]}
                </p>
              )}
            </div>
            <Button
              size="sm"
              disabled={!isAdmin || running !== null}
              onClick={() => void run(s.key)}
            >
              {running === s.key ? (
                <>
                  <Loader2 className="animate-spin" /> Import…
                </>
              ) : (
                <>
                  <Download /> Importer
                </>
              )}
            </Button>
          </article>
        ))}
      </div>
      {!isAdmin && (
        <p className="mt-3 text-[12px] text-faint">
          Seul un administrateur peut lancer un import.
        </p>
      )}
    </div>
  );
}


// ── Account requests & signup mode ───────────────────────────────────────────

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

// ── API tokens ───────────────────────────────────────────────────────────────

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
          <p className="text-[12px] text-faint">
            Authentifient votre site WordPress (newsletter, pétitions, dons).
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 border-b border-line bg-elev/40 px-4 py-2.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du token (ex : Site WordPress)"
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

function ExtendedDirectoryCard({
  enabled,
  isAdmin,
  onChanged,
}: {
  enabled: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy || !isAdmin) return;
    setBusy(true);
    const { setExtendedDirectoryAction } = await import("@/app/actions/settings");
    await setExtendedDirectoryAction(!enabled);
    setBusy(false);
    toast.success(enabled ? "Annuaire étendu désactivé" : "Annuaire étendu activé");
    onChanged();
  }

  const segments = [
    { icon: <Landmark className="size-4 text-indigo-700 dark:text-indigo-400" />, label: "Décideur·e·ses", desc: "Parlementaires, exécutifs, presse — le cœur lobbying (toujours actif)" },
    { icon: <Users className="size-4 text-emerald-600 dark:text-emerald-400" />, label: "Adhérent·e·s", desc: "Membres de votre association, avec date et mode d'adhésion" },
    { icon: <HeartHandshake className="size-4 text-rose-500 dark:text-rose-400" />, label: "Bénévoles", desc: "Engagés sur le terrain : disponibilités, missions, coordonnées" },
    { icon: <Gift className="size-4 text-amber-600 dark:text-amber-400" />, label: "Donateur·ice·s", desc: "Historique des dons (API Givoly / HelloAsso) pour les reçus fiscaux" },
    { icon: <Megaphone className="size-4 text-sky-600 dark:text-sky-400" />, label: "Soutiens", desc: "Newsletter, signataires de pétitions — alimentés via l'API WordPress" },
  ];

  return (
    <div className={cn(
      "rounded-xl border bg-card transition-colors",
      enabled ? "border-indigo-500/40 ring-1 ring-inset ring-indigo-500/20" : "border-line",
    )}>
      <div className="flex items-start justify-between gap-4 border-b border-line p-5">
        <div className="max-w-xl">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <Users className="size-4.5 text-indigo-700 dark:text-indigo-400" />
            Annuaire étendu
            {enabled && (
              <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
                Actif
              </span>
            )}
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mut">
            Transformez Actyl en véritable CRM associatif : gérez vos
            adhérent·e·s, bénévoles, donateur·ice·s et soutiens au même endroit
            que vos décideurs. Le menu latéral affiche un filtre par segment,
            et les inscriptions WordPress arrivent automatiquement dans la
            bonne catégorie.
          </p>
        </div>
        {/* Big switch */}
        <button
          role="switch"
          aria-checked={enabled}
          disabled={!isAdmin || busy}
          onClick={() => void toggle()}
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

      <ul className="grid grid-cols-1 gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-elev p-1.5">{s.icon}</span>
            <div>
              <p className="text-[13px] font-medium text-fg">{s.label}</p>
              <p className="text-[11.5px] leading-relaxed text-faint">{s.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      {!isAdmin && (
        <p className="border-t border-line px-5 py-3 text-[12px] text-faint">
          Seuls les administrateurs peuvent modifier ce réglage.
        </p>
      )}
    </div>
  );
}

// ── Newsletter module (EmailOctopus) ─────────────────────────────────────────

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
        {/* Big switch */}
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

function ApiDocsCard() {
  const snippet = `curl -X POST https://votre-domaine.fr/api/v1/supporters \\
  -H "Authorization: Bearer actyl_…" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"jean@exemple.fr","fullName":"Jean Martin",
       "city":"Rennes","source":"newsletter",
       "tags":["news-2026"]}'`;

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <h3 className="text-[13.5px] font-semibold text-fg">Connecter WordPress</h3>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] leading-relaxed text-faint">
        <li>Créez un token ci-dessus.</li>
        <li>Collez-le dans Réglages → PLAID·ACT de l&apos;extension.</li>
        <li>
          Endpoints : <code className="font-mono">POST /api/v1/supporters</code>{" "}
          (newsletter),{" "}
          <code className="font-mono">POST /api/v1/petitions/&#123;slug&#125;/signatures</code>{" "}
          (Petitioner),{" "}
          <code className="font-mono">POST /api/v1/donations</code> (Givoly),{" "}
          <code className="font-mono">GET /api/v1/ping</code>.
        </li>
      </ol>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-elev p-3 font-mono text-[10.5px] leading-relaxed text-mut ring-1 ring-inset ring-line">
        {snippet}
      </pre>
    </div>
  );
}

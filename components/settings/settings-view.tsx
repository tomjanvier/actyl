"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  UsersRound,
  ShieldCheck,
  Trash2,
  KeyRound,
  Download,
  Plug,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/constants";
import {
  deleteCustomFieldAction,
  deleteGroupAction,
  updateMemberRoleAction,
  removeMemberAction,
  removeGroupMemberAction,
} from "@/app/actions/settings";
import { CUSTOM_FIELD_TYPE_LABELS, type CustomFieldType } from "@/lib/constants";
import { EntityAvatar } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/controls";

import {
  LandingSettingsForm,
  CreateWorkspaceForm,
  ModulesCard,
  CreateFieldForm,
  CreateGroupForm,
  InviteMemberForm,
  ProfileForm,
  GROUP_DOT,
} from "./settings-forms";
import { ImportOfficials } from "./settings-imports";
import {
  AccountRequestsSection,
  ApiTokensCard,
  OidcClientsCard,
  NewsletterCard,
} from "./settings-access";
import type {
  ReferenceSource,
  RoleMeta,
} from "./settings-types";
import type { ReferencePackKey } from "@/lib/datasets/reference-packs";

export function SettingsView({
  initialTab,
  role,
  isAdmin,
  isSuperAdmin,
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
  workspaces,
  landingSettings,
  oidcClients,
}: {
  initialTab: string | null;
  role: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
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
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    memberCount: number;
    createdAt: string;
  }>;
  landingSettings: {
    heroTitle: string;
    heroHighlight: string;
    heroText: string;
    primaryCta: string;
    primaryHref: string;
    footerText: string;
  };
  oidcClients: Array<{
    id: string;
    clientId: string;
    name: string;
    redirectUris: string[];
    revokedAt: string | null;
    createdAt: string;
    tokenCount: number;
  }>;
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
          {isSuperAdmin && (
            <TabsTrigger value="espaces"><Building2 /> Espaces</TabsTrigger>
          )}
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
                fields.map((f) => {
                  const optionsSummary = formatOptionsSummary(f.options);

                  return (
                    <div
                      key={f.id}
                      className="group flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-hover"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-fg">{f.label}</p>
                        <p className="truncate text-[11px] text-faint">
                          {CUSTOM_FIELD_TYPE_LABELS[f.type as CustomFieldType] ?? f.type}
                          {optionsSummary}
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
                  );
                })
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
                      <span className={cn("size-2.5 rounded-full", GROUP_DOT[g.color] ?? "bg-coral-500")} />
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
            isAdmin={isSuperAdmin}
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
                        <span className="ml-1.5 text-[10.5px] text-coral-700 dark:text-coral-400">vous</span>
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
            isSuperAdmin={isSuperAdmin}
            canImportContacts={canImportContacts}
            referencePacks={referencePacks}
          />
        </TabsContent>

        {/* ── API et intégrations ── */}
        <TabsContent value="api" className="mt-5 outline-none">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ApiTokensCard tokens={apiTokens} isAdmin={isAdmin} onChanged={refresh} />
            {(isAdmin || isSuperAdmin) && (
              <OidcClientsCard clients={oidcClients} onChanged={refresh} />
            )}
          </div>
        </TabsContent>

        {/* ── Profil ── */}
        <TabsContent value="profil" className="mt-5 outline-none">
          <ProfileForm user={currentUser} />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="espaces" className="mt-5 outline-none">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
              <section className="overflow-hidden rounded-xl border border-line bg-card">
                <header className="border-b border-line px-4 py-3">
                  <h2 className="text-[14px] font-semibold text-fg">Espaces Actyl</h2>
                  <p className="mt-0.5 text-[11.5px] text-faint">
                    Le super-administrateur peut rejoindre chaque espace et en administrer les accès.
                  </p>
                </header>
                {workspaces.map((workspace) => (
                  <article key={workspace.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-elev text-faint ring-1 ring-inset ring-line">
                      <Building2 className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-fg">{workspace.name}</p>
                      <p className="text-[11px] text-faint">
                        {workspace.slug} · {workspace.memberCount} membre{workspace.memberCount > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-[10.5px] text-faint">
                      {new Date(workspace.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </article>
                ))}
              </section>
              <CreateWorkspaceForm onCreated={refresh} />
            </div>
            <LandingSettingsForm settings={landingSettings} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function formatOptionsSummary(serializedOptions: string | null): string | null {
  if (!serializedOptions) return null;

  try {
    const options: unknown = JSON.parse(serializedOptions);
    if (!Array.isArray(options)) return null;

    const labels = options.filter(
      (option): option is string => typeof option === "string",
    );
    if (labels.length === 0) return null;

    const preview = labels.slice(0, 3).join(", ");
    const suffix = labels.length > 3 ? "…" : "";
    return ` · ${labels.length} options · ${preview}${suffix}`;
  } catch {
    return null;
  }
}

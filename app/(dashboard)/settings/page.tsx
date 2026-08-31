import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLE_META, ROLES, can } from "@/lib/constants";
import { getSignupMode } from "@/lib/signup-mode";
import { getSegmentsConfig } from "@/lib/flags";
import { getNewsletterConfig, maskApiKey } from "@/lib/newsletter";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsView } from "@/components/settings/settings-view";
import { REFERENCE_PACKS } from "@/lib/datasets/reference-packs";
import { getDisabledReferencePacks } from "@/lib/reference-pack-settings";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const { tab } = await searchParams;

  const [
    fields,
    groups,
    memberships,
    apiTokens,
    segments,
    newsletter,
    requests,
    signupMode,
    installedReferenceLists,
    disabledReferencePacks,
    workspaces,
  ] =
    await Promise.all([
      db.customField.findMany({
        where: { workspaceId: session.workspaceId },
        orderBy: { position: "asc" },
      }),
      db.group.findMany({
        where: { workspaceId: session.workspaceId },
        orderBy: { createdAt: "asc" },
        include: {
          members: {
            include: {
              membership: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
            },
          },
          _count: { select: { campaigns: true } },
        },
      }),
      db.membership.findMany({
        where: { workspaceId: session.workspaceId },
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true, jobTitle: true } },
          groups: { include: { group: { select: { name: true } } } },
        },
      }),
      db.apiToken.findMany({
        where: { workspaceId: session.workspaceId },
        orderBy: { createdAt: "desc" },
      }),
      getSegmentsConfig(session.workspaceId),
      getNewsletterConfig(session.workspaceId),
    session.user.isSuperAdmin
      ? db.accountRequest.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    getSignupMode(),
    db.sharedList.findMany({
      where: { workspaceId: session.workspaceId, sourcePack: { not: null } },
      select: { sourcePack: true },
    }),
    getDisabledReferencePacks(session.workspaceId),
    session.user.isSuperAdmin
      ? db.workspace.findMany({
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            _count: { select: { memberships: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Paramètres" }]}
        title="Paramètres de l'espace"
        description={`${session.workspaceName} — configurez le schéma de données, les équipes et les accès.`}
      />
      <SettingsView
        initialTab={tab ?? null}
        role={session.role}
        isAdmin={session.role === "ADMIN"}
        isSuperAdmin={session.user.isSuperAdmin}
        canImportContacts={can(session.role, "contact:create")}
        currentUserId={session.user.id}
        currentUser={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          jobTitle: session.user.jobTitle,
        }}
        fields={fields.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          options: f.options,
          showInTable: f.showInTable,
        }))}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          color: g.color,
          campaignCount: g._count.campaigns,
          members: g.members.map((m) => ({
            groupMemberId: m.id,
            name: m.membership.user.name,
            email: m.membership.user.email,
          })),
        }))}
        members={memberships.map((m) => ({
          membershipId: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          jobTitle: m.user.jobTitle,
          role: (ROLES.includes(m.role as never) ? m.role : "MEMBER") as
            | "ADMIN"
            | "CAMPAIGNER"
            | "MEMBER"
            | "OBSERVER",
          groups: m.groups.map((gm) => gm.group.name),
        }))}
        roleMeta={ROLE_META}
        canManageGroups={can(session.role, "campaign:create")}
        signupMode={signupMode}
        pendingRequests={requests.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          orgName: r.orgName,
          website: r.website,
          phone: r.phone,
          createdAt: r.createdAt.toISOString(),
        }))}
        apiTokens={apiTokens.map((t) => ({
          id: t.id,
          name: t.name,
          prefix: t.prefix,
          revoked: !!t.revokedAt,
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString(),
        }))}
        segments={segments}
        referencePacks={REFERENCE_PACKS.map((pack) => ({
          ...pack,
          installed: installedReferenceLists.some(
            (list) => list.sourcePack === pack.key,
          ),
          enabled: !disabledReferencePacks.has(pack.key),
        }))}
        newsletter={{
          enabled: newsletter.enabled,
          apiKeyMasked: maskApiKey(newsletter.apiKey),
          listId: newsletter.listId,
        }}
        workspaces={workspaces.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          memberCount: workspace._count.memberships,
          createdAt: workspace.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

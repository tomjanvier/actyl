import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { CampaignHeader } from "@/components/campaigns/campaign-header";
import { EmailsView } from "@/components/emails/emails-view";
import { campaignAccessWhere, resolveCampaignAccess } from "@/lib/campaign-access";

export const metadata = { title: "Interpellation" };

export default async function EmailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const campaign = await db.campaign.findFirst({
    where: campaignAccessWhere(id, session.workspaceId),
    include: {
      squads: { include: { group: true } },
      shares: { include: { workspace: { select: { name: true } } } },
      workspace: { select: { slug: true } },
    },
  });
  if (!campaign) notFound();
  const access = resolveCampaignAccess(campaign, session.workspaceId);

  const [templates, cards, blasts] = await Promise.all([
    db.emailTemplate.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    db.kanbanCard.findMany({
      where: { campaignId: campaign.id },
      select: {
        id: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            institution: true,
            email: true,
            avatarColor: true,
          },
        },
        stage: { select: { name: true, kind: true } },
      },
    }),
    db.emailBlast.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        template: { select: { name: true } },
        creator: { select: { name: true } },
        _count: { select: { emails: true } },
      },
    }),
  ]);

  const contactIds = [...new Set(cards.map((card) => card.contact.id))];
  const deliveredEmailWhere = {
    contactId: { in: contactIds },
    status: "SENT",
    NOT: { providerId: { startsWith: "sim_" } },
  };
  const [sentByContact, openedByContact, citizensByContact, uniqueCitizenGroups] =
    contactIds.length
      ? await Promise.all([
          db.sentEmail.groupBy({
            by: ["contactId"],
            where: deliveredEmailWhere,
            _count: { _all: true },
          }),
          db.sentEmail.groupBy({
            by: ["contactId"],
            where: { ...deliveredEmailWhere, openedAt: { not: null } },
            _count: { _all: true },
          }),
          db.sentEmail.groupBy({
            by: ["contactId", "senderName"],
            where: { ...deliveredEmailWhere, senderName: { not: "" } },
          }),
          db.sentEmail.groupBy({
            by: ["senderName"],
            where: { ...deliveredEmailWhere, senderName: { not: "" } },
          }),
        ])
      : [[], [], [], []];

  const targetStats = new Map<string, { total: number; opened: number; citizens: number }>();
  for (const row of sentByContact) {
    targetStats.set(row.contactId, { total: row._count._all, opened: 0, citizens: 0 });
  }
  for (const row of openedByContact) {
    const stats = targetStats.get(row.contactId);
    if (stats) stats.opened = row._count._all;
  }
  for (const row of citizensByContact) {
    if (!row.senderName) continue;
    const stats = targetStats.get(row.contactId);
    if (stats) stats.citizens++;
  }
  const totalSent = sentByContact.reduce((sum, row) => sum + row._count._all, 0);
  const totalOpened = openedByContact.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <>
      <CampaignHeader
        campaign={{
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          workspaceSlug: campaign.workspace.slug,
          isPublished: campaign.isPublished,
          emoji: campaign.emoji,
          description: campaign.description,
          status: campaign.status,
          priority: campaign.priority,
          dueDate: campaign.dueDate?.toISOString() ?? null,
          pinned: access.owner ? campaign.pinned : (access.pinned ?? false),
          squads: campaign.squads.map((s) => ({ name: s.group.name, color: s.group.color })),
          shares: campaign.shares.map((share) => ({
            id: share.id,
            workspaceName: share.workspace.name,
            access: share.access,
          })),
        }}
        canEdit={access.canContribute && can(session.role, "campaign:edit")}
        canPublish={access.owner && can(session.role, "campaign:edit")}
        canShare={access.owner && session.role === "ADMIN"}
      />
      <EmailsView
        campaignId={campaign.id}
        campaignSlug={campaign.slug}
        workspaceSlug={campaign.workspace.slug}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          subject: t.subject,
          body: t.body,
          isDefault: t.isDefault,
        }))}
        targets={cards
          .filter((c) => c.contact.email)
          .map((c) => ({
            cardId: c.id,
            contact: c.contact,
            stageName: c.stage.name,
            emailsReceived: targetStats.get(c.contact.id)?.total ?? 0,
            opens: targetStats.get(c.contact.id)?.opened ?? 0,
            uniqueCitizens: targetStats.get(c.contact.id)?.citizens ?? 0,
          }))}
        unjoinableCount={cards.length - cards.filter((c) => c.contact.email).length}
        blasts={blasts.map((b) => ({
          id: b.id,
          subject: b.subject,
          source: b.source,
          templateName: b.template.name,
          creatorName: b.creator?.name ?? "—",
          emailCount: b._count.emails,
          createdAt: b.createdAt.toISOString(),
        }))}
        stats={{
          sent: totalSent,
          openRate: totalSent ? Math.round((totalOpened / totalSent) * 100) : 0,
          uniqueCitizens: uniqueCitizenGroups.length,
        }}
        canSend={access.canContribute && can(session.role, "email:send")}
        canManageTemplates={access.canContribute && can(session.role, "template:manage")}
      />
    </>
  );
}

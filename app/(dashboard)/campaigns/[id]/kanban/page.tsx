import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { CampaignHeader } from "@/components/campaigns/campaign-header";
import { getCampaignAccess } from "@/lib/campaign-access";

export const metadata = { title: "Pipeline" };

export default async function KanbanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const access = await getCampaignAccess(id, session.workspaceId);
  if (!access) notFound();
  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      squads: { include: { group: true } },
      shares: { include: { workspace: { select: { name: true } } } },
    },
  });
  if (!campaign) notFound();

  const [stages, cards, events, contacts] = await Promise.all([
    db.pipelineStage.findMany({
      where: { campaignId: campaign.id },
      orderBy: { position: "asc" },
    }),
    db.kanbanCard.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ position: "asc" }, { lastTouchAt: "desc" }],
      include: {
        contact: {
          select: {
            firstName: true,
            lastName: true,
            party: true,
            institution: true,
            avatarColor: true,
          },
        },
        assignedTo: { select: { name: true } },
        _count: { select: { events: true } },
      },
    }),
    db.cardEvent.findMany({
      where: { card: { campaignId: campaign.id } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        actorName: true,
        kind: true,
        fromStage: true,
        toStage: true,
        detail: true,
        createdAt: true,
        card: { select: { contact: { select: { firstName: true, lastName: true } } } },
      },
    }),
    db.contact.findMany({
      where: {
        workspaceId: campaign.workspaceId,
        NOT: { cards: { some: { campaignId: campaign.id } } },
      },
      orderBy: [{ lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        institution: true,
        party: true,
        avatarColor: true,
      },
      take: 300,
    }),
  ]);

  return (
    <>
      <CampaignHeader
        campaign={{
          id: campaign.id,
          name: campaign.name,
          emoji: campaign.emoji,
          description: campaign.description,
          status: campaign.status,
          priority: campaign.priority,
          dueDate: campaign.dueDate?.toISOString() ?? null,
          squads: campaign.squads.map((s) => ({
            name: s.group.name,
            color: s.group.color,
          })),
          slug: campaign.slug,
          pinned: access.owner ? campaign.pinned : (access.pinned ?? false),
          shares: campaign.shares.map((share) => ({
            id: share.id,
            workspaceName: share.workspace.name,
            access: share.access,
          })),
        }}
        canEdit={access.canContribute && can(session.role, "campaign:edit")}
        canShare={access.owner && session.role === "ADMIN"}
      />
      <KanbanBoard
        campaignId={campaign.id}
        stages={stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind }))}
        cards={cards.map((c) => ({
          id: c.id,
          stageId: c.stageId,
          priority: c.priority,
          role: c.role,
          position: c.position,
          lastTouchAt: c.lastTouchAt.toISOString(),
          eventCount: c._count.events,
          assignee: c.assignedTo?.name ?? null,
          contact: c.contact,
        }))}
        activity={events.map((e) => ({
          id: e.id,
          kind: e.kind,
          detail:
            e.detail ??
            `${e.actorName} : ${e.fromStage ?? ""} → ${e.toStage ?? ""}`,
          actorName: e.actorName,
          createdAt: e.createdAt.toISOString(),
        }))}
        availableContacts={access.canContribute ? contacts : []}
        canMove={can(session.role, "card:move")}
        canCreate={can(session.role, "card:create")}
        canDelete={can(session.role, "card:delete")}
      />
    </>
  );
}

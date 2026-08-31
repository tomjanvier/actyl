import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/constants";
import { getDisabledReferencePacks } from "@/lib/reference-pack-settings";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignTeamsView } from "@/components/campaign-teams/campaign-teams-view";

export const metadata = { title: "Présidentielle 2027" };

export default async function PresidentiellePage() {
  const session = await requireSession();
  const [disabledPacks, presidentialList, groups] = await Promise.all([
    getDisabledReferencePacks(session.workspaceId),
    db.sharedList.findFirst({
      where: { workspaceId: session.workspaceId, sourcePack: "presidentielle-2027" },
      select: { id: true, name: true },
    }),
    db.group.findMany({
      where: {
        workspaceId: session.workspaceId,
        ...(session.role === "ADMIN"
          ? {}
          : { members: { some: { membership: { userId: session.user.id } } } }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  if (!presidentialList || disabledPacks.has("presidentielle-2027")) {
    redirect("/settings?tab=import");
  }

  const groupIds = groups.map((group) => group.id);
  const teams = await db.campaignTeam.findMany({
    where: { workspaceId: session.workspaceId, listId: presidentialList.id },
    orderBy: [{ status: "asc" }, { candidateName: "asc" }],
    include: {
      members: {
        orderBy: [{ role: "asc" }, { contact: { lastName: "asc" } }],
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              title: true,
              party: true,
              photoUrl: true,
              avatarColor: true,
            },
          },
        },
      },
      positions: {
        where: { groupId: { in: groupIds } },
        orderBy: { updatedAt: "desc" },
        include: { group: { select: { name: true } } },
      },
    },
  });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Présidentielle 2027" }]}
        title="Présidentielle 2027"
        description={`Équipes des candidat·e·s rattachées à la liste partagée « ${presidentialList.name} » et pistes propres à vos équipes.`}
      />
      <CampaignTeamsView
        isAdmin={session.role === "ADMIN"}
        canAddPosition={can(session.role, "note:add") && groups.length > 0}
        groups={groups}
        teams={teams.map((team) => ({
          id: team.id,
          candidateName: team.candidateName,
          party: team.party,
          politicalBloc: team.politicalBloc,
          status: team.status,
          programUrl: team.programUrl,
          members: team.members.map((member) => ({
            id: member.id,
            role: member.role,
            involvement: member.involvement,
            contact: member.contact,
          })),
          positions: team.positions.map((position) => ({
            id: position.id,
            topic: position.topic,
            summary: position.summary,
            stance: position.stance,
            groupName: position.group?.name ?? "Équipe non renseignée",
            canDelete:
              session.role === "ADMIN" || position.authorId === session.user.id,
          })),
        }))}
      />
    </>
  );
}

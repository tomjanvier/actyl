import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignTeamsView } from "@/components/campaign-teams/campaign-teams-view";

export const metadata = { title: "Équipes de campagne" };

export default async function CampaignTeamsPage() {
  const session = await requireSession();
  const [teams, partyPositions] = await Promise.all([
    db.campaignTeam.findMany({
      where: { workspaceId: session.workspaceId },
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
        positions: { orderBy: { updatedAt: "desc" } },
      },
    }),
    db.politicalPosition.findMany({
      where: { workspaceId: session.workspaceId, teamId: null },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Équipes de campagne" }]}
        title="Équipes et positions politiques"
        description="Cartographiez les équipes des candidat·e·s et les positions sourcées des campagnes ou des partis."
      />
      <CampaignTeamsView
        isAdmin={session.role === "ADMIN"}
        teams={teams.map((team) => ({
          id: team.id,
          name: team.name,
          candidateName: team.candidateName,
          party: team.party,
          politicalBloc: team.politicalBloc,
          status: team.status,
          sourceLabel: team.sourceLabel,
          sourceUrl: team.sourceUrl,
          verifiedAt: team.verifiedAt?.toISOString() ?? null,
          members: team.members.map((member) => ({
            id: member.id,
            role: member.role,
            involvement: member.involvement,
            relationship: member.relationship,
            sourceLabel: member.sourceLabel,
            contact: member.contact,
          })),
          positions: team.positions.map((position) => ({
            id: position.id,
            party: position.party,
            topic: position.topic,
            summary: position.summary,
            stance: position.stance,
            evidence: position.evidence,
            sourceLabel: position.sourceLabel,
            sourceUrl: position.sourceUrl,
          })),
        }))}
        partyPositions={partyPositions.map((position) => ({
          id: position.id,
          party: position.party,
          topic: position.topic,
          summary: position.summary,
          stance: position.stance,
          evidence: position.evidence,
          sourceLabel: position.sourceLabel,
          sourceUrl: position.sourceUrl,
        }))}
      />
    </>
  );
}

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDisabledReferencePacks } from "@/lib/reference-pack-settings";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignTeamsView } from "@/components/campaign-teams/campaign-teams-view";
import { ensurePresidentialModuleScope } from "@/lib/presidential-module";

export const metadata = { title: "Présidentielle 2027" };

export default async function PresidentiellePage() {
  const session = await requireSession();
  // Répare aussi les espaces où la liste a été installée avant le module.
  await ensurePresidentialModuleScope(session.workspaceId, session.user.id);
  const [disabledPacks, presidentialList] = await Promise.all([
    getDisabledReferencePacks(session.workspaceId),
    db.sharedList.findFirst({
      where: { workspaceId: session.workspaceId, sourcePack: "presidentielle-2027" },
      select: { id: true, name: true },
    }),
  ]);

  if (!presidentialList || disabledPacks.has("presidentielle-2027")) {
    redirect("/settings?tab=import");
  }

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
        teams={teams.map((team) => ({
          id: team.id,
          candidateContactId: team.candidateContactId,
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
        }))}
      />
    </>
  );
}

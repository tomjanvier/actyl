import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDisabledReferencePacks } from "@/lib/reference-pack-settings";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignTeamsView } from "@/components/campaign-teams/campaign-teams-view";

export const metadata = { title: "Présidentielle 2027" };

export default async function PresidentiellePage() {
  const session = await requireSession();
  const [disabledPacks, presidentialList] = await Promise.all([
    getDisabledReferencePacks(session.workspaceId),
    db.sharedList.findFirst({
      where: { workspaceId: session.workspaceId, sourcePack: "presidentielle-2027" },
      select: { id: true, name: true },
    }),
  ]);

  if (!presidentialList || disabledPacks.has("presidentielle-2027")) {
    return (
      <>
        <PageHeader
          crumbs={[{ label: "Actyl" }, { label: "Présidentielle 2027" }]}
          title="Présidentielle 2027"
          description="Suivez les équipes et les candidatures dans un espace dédié."
        />
        <section className="mx-6 my-5 max-w-2xl rounded-xl border border-line bg-card p-5">
          <h2 className="text-[15px] font-semibold text-fg">
            Le référentiel Présidentielle 2027 n’est pas activé dans cet espace.
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-mut">
            Un administrateur peut l’activer dans Paramètres, sous « Référentiels & imports ».
            Une fois installé, les équipes candidates apparaîtront ici.
          </p>
          {session.role === "ADMIN" ? (
            <Link href="/settings?tab=import" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-accent-ink hover:bg-accent-hover">
              Ouvrir les référentiels <ArrowRight className="size-4" />
            </Link>
          ) : (
            <p className="mt-4 text-[12px] font-medium text-mut">
              Demandez à l’administrateur de votre espace de l’activer.
            </p>
          )}
        </section>
      </>
    );
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

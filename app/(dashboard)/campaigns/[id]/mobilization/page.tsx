import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { CampaignHeader } from "@/components/campaigns/campaign-header";
import { MobilizationView } from "@/components/campaigns/mobilization-view";
import { getCampaignAccess } from "@/lib/campaign-access";

export const metadata = { title: "Mobilisation" };

export default async function MobilizationPage({
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
      petition: {
        include: {
          signatures: { orderBy: { createdAt: "desc" }, take: 50 },
        },
      },
      events: { orderBy: { startsAt: "desc" }, take: 5 },
      shares: { include: { workspace: { select: { name: true } } } },
    },
  });
  if (!campaign) notFound();

  return (
    <>
      <CampaignHeader
        campaign={{
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
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
        canShare={access.owner && session.role === "ADMIN"}
      />
      <MobilizationView
        campaignId={campaign.id}
        campaignSlug={campaign.slug}
        canManage={access.owner && can(session.role, "email:send")}
        petition={
          campaign.petition
            ? {
                id: campaign.petition.id,
                title: campaign.petition.title,
                description: campaign.petition.description,
                goal: campaign.petition.goal,
                isPublished: campaign.petition.isPublished,
                signatureCount: campaign.petition.signatures.length,
                recentSigners: campaign.petition.signatures.slice(0, 8).map((s) => ({
                  id: s.id,
                  name: s.name,
                  city: s.city,
                  createdAt: s.createdAt.toISOString(),
                })),
              }
            : null
        }
      />
    </>
  );
}

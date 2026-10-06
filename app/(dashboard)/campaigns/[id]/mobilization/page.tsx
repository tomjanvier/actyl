import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { CampaignHeader } from "@/components/campaigns/campaign-header";
import { MobilizationView } from "@/components/campaigns/mobilization-view";
import { campaignAccessWhere, resolveCampaignAccess } from "@/lib/campaign-access";

export const metadata = { title: "Mobilisation" };

export default async function MobilizationPage({
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
      petition: {
        include: {
          signatures: { orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, city: true, createdAt: true } },
          _count: { select: { signatures: true } },
        },
      },
      shares: { include: { workspace: { select: { name: true } } } },
      workspace: { select: { slug: true } },
    },
  });
  if (!campaign) notFound();
  const access = resolveCampaignAccess(campaign, session.workspaceId);

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
      <MobilizationView
        campaignId={campaign.id}
        campaignSlug={campaign.slug}
        workspaceSlug={campaign.workspace.slug}
        campaignPublished={campaign.isPublished}
        canManage={access.owner && can(session.role, "email:send")}
        petition={
          campaign.petition
            ? {
                id: campaign.petition.id,
                title: campaign.petition.title,
                description: campaign.petition.description,
                goal: campaign.petition.goal,
                isPublished: campaign.petition.isPublished,
                signatureCount: campaign.petition._count.signatures,
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

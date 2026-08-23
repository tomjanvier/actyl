import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { CampaignHeader } from "@/components/campaigns/campaign-header";
import { MobilizationView } from "@/components/campaigns/mobilization-view";

export const metadata = { title: "Mobilisation" };

export default async function MobilizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const campaign = await db.campaign.findFirst({
    where: { id, workspaceId: session.workspaceId },
    include: {
      squads: { include: { group: true } },
      petition: {
        include: {
          signatures: { orderBy: { createdAt: "desc" }, take: 50 },
        },
      },
      events: { orderBy: { startsAt: "desc" }, take: 5 },
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
          squads: campaign.squads.map((s) => ({ name: s.group.name, color: s.group.color })),
        }}
        canEdit={can(session.role, "campaign:edit")}
      />
      <MobilizationView
        campaignId={campaign.id}
        campaignSlug={campaign.slug}
        canManage={can(session.role, "email:send")}
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

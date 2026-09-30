import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PublicCampaignPage } from "@/components/public/public-campaign-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceSlug: string; campaignSlug: string }>;
}): Promise<Metadata> {
  const { workspaceSlug, campaignSlug } = await params;
  const campaign = await db.campaign.findFirst({
    where: {
      slug: campaignSlug,
      workspace: { slug: workspaceSlug },
      isPublished: true,
      status: { notIn: ["ARCHIVED", "LOST"] },
    },
    select: { name: true, description: true, workspace: { select: { name: true } } },
  });
  return campaign
    ? { title: campaign.name, description: campaign.description ?? `Participez à cette campagne portée par ${campaign.workspace.name}.` }
    : { title: "Campagne" };
}

export default PublicCampaignPage;

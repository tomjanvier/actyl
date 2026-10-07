import "server-only";

import { db } from "@/lib/db";
import { campaignAccessWhere } from "@/lib/campaign-permissions";
export { campaignAccessWhere, resolveCampaignAccess } from "@/lib/campaign-permissions";

/** Résout l'accès d'un espace à une campagne possédée ou reçue en partage. */
export async function getCampaignAccess(campaignId: string, workspaceId: string) {
  const campaign = await db.campaign.findFirst({
    where: campaignAccessWhere(campaignId, workspaceId),
    select: {
      id: true,
      workspaceId: true,
      shares: {
        where: { workspaceId },
        select: { id: true, access: true, pinned: true },
        take: 1,
      },
    },
  });
  if (!campaign) return null;
  const owner = campaign.workspaceId === workspaceId;
  const share = campaign.shares[0] ?? null;
  return {
    campaignId: campaign.id,
    owner,
    canContribute: owner || share?.access === "CONTRIBUTE",
    pinned: owner ? null : (share?.pinned ?? false),
    shareId: share?.id ?? null,
  };
}

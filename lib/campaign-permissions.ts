/** Filtre d'accès appliqué directement à la lecture de la campagne. */
export function campaignAccessWhere(campaignId: string, workspaceId: string) {
  return {
    id: campaignId,
    OR: [{ workspaceId }, { shares: { some: { workspaceId } } }],
  };
}

/** À utiliser uniquement après une lecture filtrée par campaignAccessWhere. */
export function resolveCampaignAccess(
  campaign: {
    workspaceId: string;
    shares: Array<{ workspaceId: string; access: string; pinned: boolean }>;
  },
  workspaceId: string,
) {
  const owner = campaign.workspaceId === workspaceId;
  const share = campaign.shares.find((item) => item.workspaceId === workspaceId);
  return {
    owner,
    canContribute: owner || share?.access === "CONTRIBUTE",
    pinned: owner ? null : (share?.pinned ?? false),
  };
}

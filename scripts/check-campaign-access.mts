import assert from "node:assert/strict";
import { campaignAccessWhere, resolveCampaignAccess } from "../lib/campaign-permissions";
import { db } from "../lib/db";
// Les droits d'un autre espace ne doivent jamais être réutilisés pour le visiteur.
const shared = {
    workspaceId: "owner",
    shares: [
        { workspaceId: "reader", access: "VIEW", pinned: true },
        { workspaceId: "contributor", access: "CONTRIBUTE", pinned: false },
    ],
};
assert.equal(resolveCampaignAccess(shared, "owner").canContribute, true);
assert.equal(resolveCampaignAccess(shared, "reader").canContribute, false);
assert.equal(resolveCampaignAccess(shared, "reader").pinned, true);
assert.equal(resolveCampaignAccess(shared, "contributor").canContribute, true);
assert.equal(resolveCampaignAccess(shared, "outsider").canContribute, false);
assert.equal(resolveCampaignAccess(shared, "outsider").pinned, false);
// Vérification en lecture seule sur une vraie campagne, si la base est configurée.
if (process.env.DATABASE_URL) {
    const campaign = await db.campaign.findFirst({ select: { id: true, workspaceId: true } });
    if (campaign) {
        const owned = await db.campaign.findFirst({ where: campaignAccessWhere(campaign.id, campaign.workspaceId), select: { id: true } });
        const denied = await db.campaign.findFirst({ where: campaignAccessWhere(campaign.id, "__actyl_access_check_outsider__"), select: { id: true } });
        assert.equal(owned?.id, campaign.id);
        assert.equal(denied, null);
    }
}
await db.$disconnect();
console.log("Campaign access: owner, VIEW, CONTRIBUTE and unrelated workspace checks passed.");

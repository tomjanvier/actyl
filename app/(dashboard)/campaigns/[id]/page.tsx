import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

/** Résout un lien court par identifiant ou par slug vers le kanban. */
export default async function CampaignShortcutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const campaign = await db.campaign.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      AND: {
        OR: [
          { workspaceId: session.workspaceId },
          { shares: { some: { workspaceId: session.workspaceId } } },
        ],
      },
    },
    select: { id: true },
  });
  if (!campaign) notFound();
  redirect(`/campaigns/${campaign.id}/kanban`);
}

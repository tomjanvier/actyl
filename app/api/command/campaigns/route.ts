import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ campaigns: [] }, { status: 401 });
  const campaigns = await db.campaign.findMany({
    where: {
      OR: [
        { workspaceId: session.workspaceId },
        { shares: { some: { workspaceId: session.workspaceId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      emoji: true,
      pinned: true,
      workspaceId: true,
      shares: {
        where: { workspaceId: session.workspaceId },
        select: { pinned: true },
        take: 1,
      },
    },
    take: 12,
  });
  return NextResponse.json({
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      emoji: campaign.emoji,
      pinned:
        campaign.workspaceId === session.workspaceId
          ? campaign.pinned
          : (campaign.shares[0]?.pinned ?? false),
    })),
  });
}

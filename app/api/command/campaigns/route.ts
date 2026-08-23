import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ campaigns: [] }, { status: 401 });
  const campaigns = await db.campaign.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, emoji: true },
    take: 12,
  });
  return NextResponse.json({ campaigns });
}

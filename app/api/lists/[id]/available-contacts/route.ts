import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/constants";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401, headers });
  const { id } = await params;
  const list = await db.sharedList.findFirst({ where: { id, workspaceId: session.workspaceId }, select: { createdById: true, sourcePack: true } });
  if (!list) return NextResponse.json({ error: "Liste indisponible." }, { status: 404, headers });
  if (!can(session.role, "list:create") || !(session.role === "ADMIN" || list.sourcePack || list.createdById === session.user.id)) return NextResponse.json({ error: "Accès refusé." }, { status: 403, headers });
  const page = Number(request.nextUrl.searchParams.get("page") || 1);
  const query = request.nextUrl.searchParams.get("q") || "";
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || query.length > 100) return NextResponse.json({ error: "Filtres invalides." }, { status: 400, headers });
  const rows = await db.contact.findMany({
    where: {
      workspaceId: session.workspaceId,
      listItems: { none: { listId: id } },
      ...(query.trim() && { AND: query.trim().split(/\s+/).map(term => ({ OR: ["firstName", "lastName", "institution", "party"].map(field => ({ [field]: { contains: term, mode: "insensitive" as const } })) })) }),
    },
    select: { id: true, firstName: true, lastName: true, title: true, institution: true, party: true, level: true, stance: true, email: true, photoUrl: true, avatarColor: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    skip: (page - 1) * 50, take: 51,
  });
  return NextResponse.json({ rows: rows.slice(0, 50), hasMore: rows.length > 50 }, { headers });
}

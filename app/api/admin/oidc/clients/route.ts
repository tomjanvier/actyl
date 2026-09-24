import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { registerClient } from "@/lib/oidc";

export const dynamic = "force-dynamic";

async function isOidcAdmin() {
  const session = await getSession();
  return !!session?.user.isSuperAdmin;
}

export async function GET() {
  if (!(await isOidcAdmin())) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }
  const clients = await db.oidcClient.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      clientId: true,
      name: true,
      redirectUris: true,
      revokedAt: true,
      createdAt: true,
      _count: { select: { tokens: true } },
    },
  });
  return Response.json(clients.map((client) => ({
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    redirectUris: client.redirectUris.split("\n").filter(Boolean),
    revokedAt: client.revokedAt?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
    tokenCount: client._count.tokens,
  })));
}

export async function POST(request: Request) {
  return registerClient(request);
}

export async function PATCH(request: Request) {
  if (!(await isOidcAdmin())) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origine refusée." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as {
    clientId?: unknown;
    revoked?: unknown;
  } | null;
  if (!body || typeof body.clientId !== "string" || typeof body.revoked !== "boolean") {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const client = await db.oidcClient.findUnique({ where: { id: body.clientId } });
  if (!client) return Response.json({ error: "Client introuvable." }, { status: 404 });

  const now = new Date();
  await db.$transaction([
    db.oidcClient.update({
      where: { id: client.id },
      data: { revokedAt: body.revoked ? now : null },
    }),
    ...(body.revoked
      ? [db.oidcAccessToken.updateMany({
          where: { clientId: client.id, revokedAt: null },
          data: { revokedAt: now },
        })]
      : []),
  ]);
  return Response.json({ ok: true });
}

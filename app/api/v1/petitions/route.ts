import {
  authenticateApiRequest,
  apiError,
  apiJson,
  apiOptions,
} from "@/lib/api";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Liste les pétitions publiées de l'espace authentifié. */
export async function GET(request: Request) {
  const ctx = await authenticateApiRequest(request);
  if (!ctx) return apiError(401, "Token API invalide ou révoqué.");

  const rl = rateLimit(`api:${ctx.tokenId}:${await clientIp()}`, 60);
  if (!rl.allowed) {
    return apiError(429, `Trop de requêtes. Réessayez dans ${rl.retryAfterSec}s.`);
  }

  const petitions = await db.petition.findMany({
    where: { workspaceId: ctx.workspaceId, isPublished: true },
    orderBy: { title: "asc" },
    select: {
      title: true,
      isPublished: true,
      campaign: { select: { slug: true } },
      _count: { select: { signatures: true } },
    },
  });

  return apiJson(
    petitions.map((petition) => ({
      slug: petition.campaign.slug,
      title: petition.title,
      count: petition._count.signatures,
      isPublished: petition.isPublished,
    })),
  );
}

export async function OPTIONS() {
  return apiOptions();
}

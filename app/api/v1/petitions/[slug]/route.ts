import {
  authenticateApiRequest,
  apiError,
  apiJson,
  apiOptions,
} from "@/lib/api";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Retourne une pétition publiée à partir du slug de sa campagne. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ctx = await authenticateApiRequest(request);
  if (!ctx) return apiError(401, "Token API invalide ou révoqué.");

  const rl = rateLimit(`api:${ctx.tokenId}:${await clientIp()}`, 60);
  if (!rl.allowed) {
    return apiError(429, `Trop de requêtes. Réessayez dans ${rl.retryAfterSec}s.`);
  }

  const { slug } = await params;
  const petition = await db.petition.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      isPublished: true,
      campaign: { slug },
    },
    select: {
      title: true,
      isPublished: true,
      campaign: { select: { slug: true } },
      _count: { select: { signatures: true } },
    },
  });
  if (!petition) return apiError(404, "Pétition introuvable ou non publiée.");

  return apiJson({
    slug: petition.campaign.slug,
    title: petition.title,
    isPublished: petition.isPublished,
    count: petition._count.signatures,
  });
}

export async function OPTIONS() {
  return apiOptions();
}

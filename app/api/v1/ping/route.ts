import { authenticateApiRequest, apiJson, apiError, apiOptions } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Vérification de connexion utilisée par les réglages de l'extension WordPress. */
export async function GET(request: Request) {
  const ctx = await authenticateApiRequest(request);
  if (!ctx) return apiError(401, "Token API invalide ou révoqué.");
  const rl = rateLimit(`api:${ctx.tokenId}:${await clientIp()}`, 60);
  if (!rl.allowed) {
    return apiError(429, `Trop de requêtes. Réessayez dans ${rl.retryAfterSec}s.`);
  }
  return apiJson({ ok: true, workspaceId: ctx.workspaceId });
}

export async function OPTIONS() {
  return apiOptions();
}

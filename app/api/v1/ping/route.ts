import { authenticateApiRequest, apiJson, apiError, apiOptions } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Vérification de connexion utilisée par les réglages de l'extension WordPress. */
export async function GET(request: Request) {
  const ctx = await authenticateApiRequest(request);
  if (!ctx) return apiError(401, "Token API invalide ou révoqué.");
  return apiJson({ ok: true, workspaceId: ctx.workspaceId });
}

export async function OPTIONS() {
  return apiOptions();
}

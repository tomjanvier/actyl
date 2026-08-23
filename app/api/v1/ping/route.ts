import { authenticateApiRequest, apiJson, apiError, apiOptions } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Connection check for the WordPress plugin settings screen. */
export async function GET(request: Request) {
  const ctx = await authenticateApiRequest(request);
  if (!ctx) return apiError(401, "Token API invalide ou révoqué.");
  return apiJson({ ok: true, workspaceId: ctx.workspaceId });
}

export async function OPTIONS() {
  return apiOptions();
}

import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Authentification de l'API publique d'ingestion (/api/v1/*).
 *
 * Les jetons suivent le format `actyl_<32 caractères hexadécimaux>`. Seul leur
 * condensat SHA-256 est stocké. La comparaison est réalisée en temps constant
 * et le préfixe permet l'identification sans conserver le secret.
 */
const PREFIX = "actyl_";

export function generateApiToken(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = PREFIX + randomBytes(24).toString("hex");
  return {
    plaintext,
    hash: hashToken(plaintext),
    prefix: plaintext.slice(0, 12),
  };
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export type ApiContext = {
  workspaceId: string;
  tokenId: string;
};

/**
 * Résout le jeton Bearer vers son espace. Retourne null s'il est absent, mal
 * formé, révoqué ou inconnu, puis actualise lastUsedAt si possible.
 */
export async function authenticateApiRequest(
  request: Request,
): Promise<ApiContext | null> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;

  const plaintext = header.slice(7).trim();
  // Shape check before hashing (cheap rejection of garbage).
  if (!plaintext.startsWith(PREFIX) || plaintext.length !== PREFIX.length + 48) {
    return null;
  }

  const hash = hashToken(plaintext);
  const token = await db.apiToken.findUnique({
    where: { tokenHash: hash },
    select: { id: true, workspaceId: true, revokedAt: true },
  });
  if (!token || token.revokedAt) return null;

  void db.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { workspaceId: token.workspaceId, tokenId: token.id };
}

/** Compare en temps constant les secrets qui ne sont pas des jetons. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

/**
 * CORS pour /api/v1/* : WordPress appelle l'API côté serveur, mais une utilisation
 * not required, but permissive read/preflight keeps browser-based integrations
 * côté navigateur reste possible sans affaiblir l'authentification Bearer.
 */
export const apiCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function apiJson(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...apiCorsHeaders },
  });
}

export function apiError(
  status: 400 | 401 | 404 | 409 | 429 | 500,
  error: string,
  extra?: Record<string, unknown>,
): Response {
  return apiJson({ error, ...extra }, status);
}

export function apiOptions(): Response {
  return new Response(null, { status: 204, headers: apiCorsHeaders });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

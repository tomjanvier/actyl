import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Public ingest API auth (/api/v1/*).
 *
 * Tokens look like `ahq_<32 hex chars>`. Only a SHA-256 hash is stored, so a
 * DB leak never leaks usable credentials. Comparison is constant-time and the
 * prefix column lets users identify tokens in the UI without storing secrets.
 */
const PREFIX = "ahq_";

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
 * Resolve the Bearer token to its workspace. Returns null when missing,
 * malformed, revoked or unknown. Updates lastUsedAt opportunistically.
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

/** Constant-time string comparison for non-token secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

/**
 * CORS for /api/v1/*: the WordPress plugin calls server-side (PHP) so CORS is
 * not required, but permissive read/preflight keeps browser-based integrations
 * possible without weakening auth (Bearer token still mandatory).
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

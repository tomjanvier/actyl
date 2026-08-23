import { z } from "zod";
import {
  authenticateApiRequest,
  apiJson,
  apiError,
  apiOptions,
  readJsonBody,
} from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { upsertSupporter } from "@/lib/supporters";
import { upsertContactByEmail, validEmail, cleanStr, cleanTags } from "@/lib/ingest";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  // Where the signup came from, e.g. "newsletter", "wordpress:accueil"
  source: z.string().max(60).optional(),
  category: z.enum(["SUPPORTER", "MEMBER", "VOLUNTEER", "DONOR"]).optional(),
  tags: z.array(z.string()).or(z.string()).optional(),
});

/**
 * Ingest a person (newsletter signup, membership form…).
 *
 *   curl -X POST https://votre-domaine/api/v1/supporters \
 *     -H "Authorization: Bearer ahq_…" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"a@b.fr","fullName":"Jean Martin","city":"Rennes",
 *          "source":"newsletter","tags":["newsletter-2026"]}'
 *
 * Idempotent: re-posting the same email updates instead of duplicating.
 */
export async function POST(request: Request) {
  const ctx = await authenticateApiRequest(request);
  if (!ctx) return apiError(401, "Token API invalide ou révoqué.");

  const rl = rateLimit(`api:${ctx.tokenId}:${await clientIp()}`, 60);
  if (!rl.allowed)
    return apiError(429, `Trop de requêtes. Réessayez dans ${rl.retryAfterSec}s.`);

  const body = await readJsonBody(request);
  if (!body) return apiError(400, "Corps JSON invalide.");

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return apiError(400, parsed.error.issues[0]?.message ?? "Données invalides.");

  const email = validEmail(parsed.data.email);
  if (!email) return apiError(400, "Adresse email invalide.");

  const tags = cleanTags(parsed.data.tags);

  // Unified supporter registry (touch tracking / Soutiens page).
  await upsertSupporter({
    email,
    name: parsed.data.fullName || [parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(" ") || email.split("@")[0]!,
    city: cleanStr(parsed.data.city, 80) ?? undefined,
    workspaceId: ctx.workspaceId,
    source: cleanStr(parsed.data.source, 60) ?? "newsletter",
    tags,
  }).catch(() => {});

  // Extended directory (annuaire étendu): mirror as a Contact.
  const contact = await upsertContactByEmail({
    workspaceId: ctx.workspaceId,
    email,
    firstName: cleanStr(parsed.data.firstName, 80),
    lastName: cleanStr(parsed.data.lastName, 80),
    fullName: cleanStr(parsed.data.fullName, 160),
    city: cleanStr(parsed.data.city, 80),
    phone: cleanStr(parsed.data.phone, 40),
    category: parsed.data.category ?? "SUPPORTER",
    themes: tags,
  });

  return apiJson(
    { ok: true, contactId: contact.id, created: contact.created },
    contact.created ? 201 : 200,
  );
}

export async function OPTIONS() {
  return apiOptions();
}

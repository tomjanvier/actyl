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
import { validEmail, cleanStr, cleanTags } from "@/lib/ingest";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().min(2),
  email: z.string(),
  city: z.string().optional(),
  tags: z.array(z.string()).or(z.string()).optional(),
});

/**
 * Remote petition signature (WordPress Petitioner → AdvocacyHQ).
 * The petition is identified by its campaign slug; it must be published.
 *
 *   curl -X POST https://votre-domaine/api/v1/petitions/{slug}/signatures \
 *     -H "Authorization: Bearer ahq_…" -H "Content-Type: application/json" \
 *     -d '{"name":"Jean Martin","email":"a@b.fr","city":"Rennes"}'
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ctx = await authenticateApiRequest(request);
  if (!ctx) return apiError(401, "Token API invalide ou révoqué.");

  const rl = rateLimit(`api:${ctx.tokenId}:${await clientIp()}`, 60);
  if (!rl.allowed)
    return apiError(429, `Trop de requêtes. Réessayez dans ${rl.retryAfterSec}s.`);

  const { slug } = await params;
  const body = await readJsonBody(request);
  if (!body) return apiError(400, "Corps JSON invalide.");

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return apiError(400, parsed.error.issues[0]?.message ?? "Données invalides.");

  const email = validEmail(parsed.data.email);
  if (!email) return apiError(400, "Adresse email invalide.");
  const name = parsed.data.name.trim().slice(0, 80);
  const city = cleanStr(parsed.data.city, 80);

  const petition = await db.petition.findFirst({
    where: { isPublished: true, campaign: { slug, workspaceId: ctx.workspaceId } },
    select: { id: true },
  });
  if (!petition) return apiError(404, "Pétition introuvable ou non publiée.");

  await db.petitionSignature.upsert({
    where: { petitionId_email: { petitionId: petition.id, email } },
    create: { petitionId: petition.id, name, email, city },
    update: { name, city },
  });

  const tags = cleanTags(parsed.data.tags);
  await upsertSupporter({
    email,
    name,
    city: city ?? undefined,
    workspaceId: ctx.workspaceId,
    source: "petition",
    tags: ["petition", slug.slice(0, 20), ...tags],
  }).catch(() => {});

  const count = await db.petitionSignature.count({ where: { petitionId: petition.id } });
  return apiJson({ ok: true, count }, 201);
}

export async function OPTIONS() {
  return apiOptions();
}

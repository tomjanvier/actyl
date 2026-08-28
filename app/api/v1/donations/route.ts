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
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  city: z.string().optional(),
  // Montant dans l'unité principale (25,5) ou en centimes (2550).
  amount: z.number().nonnegative().optional(),
  amountCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  provider: z.string().max(40).optional(), // givoly | helloasso | check…
  label: z.string().max(160).optional(),
  occurredAt: z.string().datetime().optional(),
  tags: z.array(z.string()).or(z.string()).optional(),
});

/**
 * Record a donation (Givoly, HelloAsso, cheque logging…). Creates or enriches
 * le donateur dans l'annuaire avec le segment DONOR et conserve la
 * piste comptable nécessaire aux reçus et justificatifs fiscaux.
 *
 *   curl -X POST https://votre-domaine/api/v1/donations \
 *     -H "Authorization: Bearer actyl_…" -H "Content-Type: application/json" \
 *     -d '{"email":"a@b.fr","fullName":"Jean Martin","amount":50,
 *          "provider":"givoly","label":"Don campagne"}'
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

  const { amount, amountCents } = parsed.data;
  if (amount === undefined && amountCents === undefined)
    return apiError(400, "Montant requis (amount ou amountCents).");
  const cents =
    amountCents !== undefined
      ? Math.round(amountCents)
      : Math.round(amount! * 100);
  if (cents < 1 || cents > 1_000_000_00)
    return apiError(400, "Montant hors limites (max 1 000 000 €).");

  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date();
  const name =
    parsed.data.fullName ||
    [parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(" ") ||
    email.split("@")[0]!;
  const city = cleanStr(parsed.data.city, 80);
  const tags = cleanTags(parsed.data.tags);

  const [donation] = await db.$transaction([
    db.donation.create({
      data: {
        workspaceId: ctx.workspaceId,
        email,
        name: name.slice(0, 200),
        city,
        amountCents: cents,
        currency: parsed.data.currency?.toUpperCase() ?? "EUR",
        provider: cleanStr(parsed.data.provider, 40),
        label: cleanStr(parsed.data.label, 160),
        occurredAt,
      },
      select: { id: true },
    }),
  ]);

  const contact = await upsertContactByEmail({
    workspaceId: ctx.workspaceId,
    email,
    firstName: cleanStr(parsed.data.firstName, 80),
    lastName: cleanStr(parsed.data.lastName, 80),
    fullName: cleanStr(parsed.data.fullName, 160),
    city,
    category: "DONOR",
    themes: tags,
  });
  await db.donation
    .update({ where: { id: donation.id }, data: { contactId: contact.id } })
    .catch(() => {});

  await upsertSupporter({
    email,
    name: name.slice(0, 200),
    city: city ?? undefined,
    workspaceId: ctx.workspaceId,
    source: "donation",
    tags: ["donateur", ...(tags ?? [])],
  }).catch(() => {});

  return apiJson(
    { ok: true, donationId: donation.id, contactId: contact.id },
    201,
  );
}

export async function OPTIONS() {
  return apiOptions();
}

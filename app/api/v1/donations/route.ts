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

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

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

  const rawIdempotencyKey = request.headers.get("Idempotency-Key");
  const idempotencyKey = rawIdempotencyKey?.trim() ?? null;
  if (rawIdempotencyKey !== null && !/^[\x21-\x7E]{8,128}$/.test(idempotencyKey ?? "")) {
    return apiError(400, "Idempotency-Key doit contenir entre 8 et 128 caractères ASCII imprimables.");
  }

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
  const donationName = name.slice(0, 200);
  const currency = parsed.data.currency?.toUpperCase() ?? "EUR";
  const provider = cleanStr(parsed.data.provider, 40);
  const label = cleanStr(parsed.data.label, 160);
  const firstName = cleanStr(parsed.data.firstName, 80);
  const lastName = cleanStr(parsed.data.lastName, 80);
  const fullName = cleanStr(parsed.data.fullName, 160);
  const payloadHash = idempotencyKey
    ? await sha256(JSON.stringify({
        email,
        name: donationName,
        city,
        amountCents: cents,
        currency,
        provider,
        label,
        // A retry without an explicit date must hash identically even though
        // the persisted donation timestamp defaults to the current time.
        occurredAt: parsed.data.occurredAt ? occurredAt.toISOString() : null,
        firstName,
        lastName,
        fullName,
        tags: [...(tags ?? [])].sort(),
      }))
    : null;
  const keyHash = idempotencyKey ? await sha256(idempotencyKey) : null;

  let donationId: string;
  let replayed = false;
  if (keyHash && payloadHash) {
    const existing = await db.donation.findUnique({
      where: { workspaceId_idempotencyKey: { workspaceId: ctx.workspaceId, idempotencyKey: keyHash } },
      select: { id: true, requestHash: true },
    });
    if (existing) {
      if (existing.requestHash !== payloadHash) {
        return apiError(409, "Cette clé d’idempotence a déjà été utilisée avec des données différentes.");
      }
      donationId = existing.id;
      replayed = true;
    } else {
      try {
        const donation = await db.donation.create({
          data: {
            workspaceId: ctx.workspaceId,
            email,
            name: donationName,
            city,
            amountCents: cents,
            currency,
            provider,
            idempotencyKey: keyHash,
            requestHash: payloadHash,
            label,
            occurredAt,
          },
          select: { id: true },
        });
        donationId = donation.id;
      } catch (error) {
        // Deux retries simultanés peuvent tous deux manquer le premier lookup.
        const raced = await db.donation.findUnique({
          where: { workspaceId_idempotencyKey: { workspaceId: ctx.workspaceId, idempotencyKey: keyHash } },
          select: { id: true, requestHash: true },
        });
        if (!raced) throw error;
        if (raced.requestHash !== payloadHash) {
          return apiError(409, "Cette clé d’idempotence a déjà été utilisée avec des données différentes.");
        }
        donationId = raced.id;
        replayed = true;
      }
    }
  } else {
    const donation = await db.donation.create({
      data: {
        workspaceId: ctx.workspaceId,
        email,
        name: donationName,
        city,
        amountCents: cents,
        currency,
        provider,
        label,
        occurredAt,
      },
      select: { id: true },
    });
    donationId = donation.id;
  }

  const contact = await upsertContactByEmail({
    workspaceId: ctx.workspaceId,
    email,
    firstName,
    lastName,
    fullName,
    city,
    category: "DONOR",
    themes: tags,
  });
  await db.donation.update({ where: { id: donationId }, data: { contactId: contact.id } });

  await upsertSupporter({
    email,
    name: name.slice(0, 200),
    city: city ?? undefined,
    workspaceId: ctx.workspaceId,
    source: "donation",
    tags: ["donateur", ...(tags ?? [])],
  });

  return apiJson(
    { ok: true, donationId, contactId: contact.id, ...(replayed ? { idempotentReplay: true } : {}) },
    replayed ? 200 : 201,
  );
}

export async function OPTIONS() {
  return apiOptions();
}

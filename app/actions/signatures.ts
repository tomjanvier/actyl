"use server";

/**
 * Gestion des signatures : suppression, export CSV, conversion en
 * contacts d'annuaire et envoi groupé aux signataires. Chaque action est isolée
 * dans l'espace de l'appelant au moyen de l'identifiant de campagne.
 */

import { EMAIL_BATCH_LIMIT, EMAIL_BATCH_ERROR } from "@/lib/email-batch";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { dispatchEmail } from "@/lib/email";
import { upsertContactByEmail } from "@/lib/ingest";
import { toCSV } from "@/lib/utils";

const MAX_BATCH = EMAIL_BATCH_LIMIT;
const MAX_EXPORT = 50_000;
const MAX_SUBJECT = 200;
const MAX_BODY = 8000;

async function requirePetition(campaignId: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Non authentifié" };
  if (!can(session.role, "email:send"))
    return { ok: false as const, error: "Permission refusée" };
  const petition = await db.petition.findFirst({
    where: { campaignId, workspaceId: session.workspaceId },
    select: { id: true },
  });
  if (!petition)
    return { ok: false as const, error: "Pétition introuvable" };
  return {
    ok: true as const,
    petitionId: petition.id,
    workspaceId: session.workspaceId,
    workspaceName: session.workspaceName,
  };
}

function revalidateSignatures(campaignId: string) {
  revalidatePath(`/campaigns/${campaignId}/signatures`);
  revalidatePath(`/campaigns/${campaignId}/mobilization`);
}

/** Supprime uniquement une sélection explicite de signatures. */
export async function deleteSignaturesAction(input: {
  campaignId: string;
  ids: string[];
}): Promise<{ ok?: true; deleted?: number; error?: string }> {
  const ctx = await requirePetition(input.campaignId);
  if (!ctx.ok) return { error: ctx.error };

  if (!Array.isArray(input.ids) || !input.ids.length || input.ids.length > MAX_BATCH || input.ids.some(id => typeof id !== "string" || !id))
    return { error: "Sélectionnez entre 1 et 500 signatures à supprimer." };

  const result = await db.petitionSignature.deleteMany({
    where: {
      petitionId: ctx.petitionId,
      id: { in: input.ids },
    },
  });
  revalidateSignatures(input.campaignId);
  return { ok: true, deleted: result.count };
}

/**
 * Convertit les signatures en contacts du segment SUPPORTER.
 * L'opération est idempotente : l'existant est enrichi sans être dupliqué.
 */
export async function convertSignaturesToContactsAction(input: {
  campaignId: string;
  ids: string[];
}): Promise<
  | { ok: true; created: number; updated: number }
  | { error: string }
> {
  const ctx = await requirePetition(input.campaignId);
  if (!ctx.ok) return { error: ctx.error };
  if (!Array.isArray(input.ids) || !input.ids.length || input.ids.length > MAX_BATCH || input.ids.some(id => typeof id !== "string" || !id))
    return { error: "Sélectionnez entre 1 et 500 signatures à convertir." };

  const signatures = await db.petitionSignature.findMany({
    where: { petitionId: ctx.petitionId, id: { in: input.ids } },
    select: { name: true, email: true, city: true },
  });

  let created = 0;
  let updated = 0;
  for (const s of signatures) {
    const res = await upsertContactByEmail({
      workspaceId: ctx.workspaceId,
      email: s.email,
      fullName: s.name,
      city: s.city,
      category: "SUPPORTER",
    });
    if (res.created) created++;
    else updated++;
  }
  revalidatePath("/contacts");
  revalidateSignatures(input.campaignId);
  return { ok: true, created, updated };
}

/** Exporte toutes les signatures de la pétition en CSV. */
export async function exportSignaturesCsvAction(input: {
  campaignId: string;
}): Promise<{ csv?: string; count?: number; error?: string }> {
  const ctx = await requirePetition(input.campaignId);
  if (!ctx.ok) return { error: ctx.error };

  const rows = await db.petitionSignature.findMany({
    where: { petitionId: ctx.petitionId },
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT + 1,
    select: { name: true, email: true, city: true, createdAt: true },
  });
  if (rows.length > MAX_EXPORT)
    return { error: "Cette pétition dépasse 50 000 signatures. L’export complet nécessite un traitement dédié ; aucun fichier partiel n’a été produit." };
  const csv =
    "\uFEFF" +
    toCSV(
      rows.map((r) => ({
        nom: r.name,
        email: r.email,
        ville: r.city ?? "",
        date_signature: r.createdAt.toISOString().slice(0, 10),
      })),
    );
  return { csv, count: rows.length };
}

/** Produit l'aperçu des destinataires de la fenêtre d'envoi. */
export async function countPetitionSignersAction(input: {
  campaignId: string;
}): Promise<{ count?: number; error?: string }> {
  const ctx = await requirePetition(input.campaignId);
  if (!ctx.ok) return { error: ctx.error };
  const count = await db.petitionSignature.count({ where: { petitionId: ctx.petitionId } });
  return { count };
}

/** Envoie une annonce à chaque signataire distinct de la pétition. */
export async function emailPetitionSignersAction(input: {
  campaignId: string;
  subject: string;
  body: string;
}): Promise<
  | { ok: true; sent: number; failed: number; simulated: boolean }
  | { error: string }
> {
  const ctx = await requirePetition(input.campaignId);
  if (!ctx.ok) return { error: ctx.error };

  const subject = input.subject.trim().slice(0, MAX_SUBJECT);
  const body = input.body.trim().slice(0, MAX_BODY);
  if (subject.length < 2) return { error: "Objet requis." };
  if (body.length < 10) return { error: "Message trop court." };

  const signatures = await db.petitionSignature.findMany({
    where: { petitionId: ctx.petitionId },
    select: { email: true },
    take: EMAIL_BATCH_LIMIT + 1,
  });
  // Distinct emails (a signer can appear once, but stay defensive).
  const recipients = [...new Set(signatures.map((s) => s.email))];
  if (recipients.length > EMAIL_BATCH_LIMIT) return { error: EMAIL_BATCH_ERROR };
  if (!recipients.length) return { error: "Aucun signataire à contacter." };

  const workspaceName = ctx.workspaceName;

  const results = await Promise.allSettled(
    recipients.map((email) =>
      dispatchEmail({
        to: email,
        subject,
        html:
          `<!doctype html><html><body style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#18181b;max-width:600px;margin:0 auto;padding:24px">` +
          `<p style="margin:0 0 16px">Bonjour,</p>` +
          body
            .split(/\n{2,}/)
            .map(
              (p) =>
                `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
            )
            .join("") +
          `<p style="color:#71717a;font-size:12px;margin-top:28px">— ${escapeHtml(workspaceName)} · Vous recevez cet email en tant que signataire de notre pétition.</p>` +
          `</body></html>`,
      }),
    ),
  );

  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) sent++;
    else failed++;
  }

  return { ok: true, sent, failed, simulated: !process.env.RESEND_API_KEY };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

"use server";

/**
 * Moteur d'interpellation partagé entre les modèles d'équipe, les envois
 * internes et les messages citoyens publics. Sans clé Resend, le pipeline
 * fonctionne en mode simulé tout en conservant sa traçabilité.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { dispatchEmail, renderTemplate, wrapEmailHtml } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { upsertSupporter } from "@/lib/supporters";
import { normalizeFr } from "@/lib/utils";
import { getCampaignAccess } from "@/lib/campaign-access";

type Result = { ok?: boolean; error?: string; sent?: number; failed?: number };

// ── Templates ────────────────────────────────────────────────────────────────

export async function createTemplateAction(
  _prev: unknown,
  formData: FormData,
): Promise<Result & { templateId?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "template:manage")) return { error: "Permission refusée" };

  const campaignId = String(formData.get("campaignId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!campaignId || name.length < 3) return { error: "Nom du modèle requis" };
  if (!subject) return { error: "Objet requis" };
  if (body.length < 20) return { error: "Corps du message trop court" };

  const access = await getCampaignAccess(campaignId, session.workspaceId);
  if (!access?.canContribute) return { error: "Campagne introuvable ou en lecture seule" };

  const tpl = await db.emailTemplate.create({
    data: { campaignId, name, subject, body },
  });
  revalidatePath(`/campaigns/${campaignId}/emails`);
  return { ok: true, templateId: tpl.id };
}

export async function updateTemplateAction(input: {
  templateId: string;
  subject: string;
  body: string;
}): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "template:manage")) return { error: "Permission refusée" };
  const tpl = await db.emailTemplate.findFirst({
    where: {
      id: input.templateId,
      campaign: {
        OR: [
          { workspaceId: session.workspaceId },
          { shares: { some: { workspaceId: session.workspaceId, access: "CONTRIBUTE" } } },
        ],
      },
    },
  });
  if (!tpl) return { error: "Modèle introuvable" };
  if (!input.subject.trim()) return { error: "Objet requis" };
  await db.emailTemplate.update({
    where: { id: input.templateId },
    data: { subject: input.subject.trim(), body: input.body },
  });
  revalidatePath(`/campaigns/${tpl.campaignId}/emails`);
  return { ok: true };
}

export async function deleteTemplateAction(templateId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "template:manage"))
    throw new Error("Permission refusée");
  const tpl = await db.emailTemplate.findFirst({
    where: {
      id: templateId,
      campaign: {
        OR: [
          { workspaceId: session.workspaceId },
          { shares: { some: { workspaceId: session.workspaceId, access: "CONTRIBUTE" } } },
        ],
      },
    },
  });
  if (!tpl) throw new Error("Modèle introuvable");
  const usedByBlast = await db.emailBlast.count({ where: { templateId } });
  if (usedByBlast > 0) return;
  await db.emailTemplate.delete({ where: { id: templateId } });
  revalidatePath(`/campaigns/${tpl.campaignId}/emails`);
}

// ── Envoi interne de l'équipe vers les cibles ────────────────────────────────

function contactContext(c: {
  firstName: string;
  lastName: string;
  title: string | null;
  institution: string | null;
}) {
  return {
    decision_maker_name: `${c.firstName} ${c.lastName}`,
    decision_maker_first_name: c.firstName,
    decision_maker_last_name: c.lastName,
    decision_maker_title: c.title ?? "",
    institution: c.institution ?? "",
  };
}

export async function launchBlastAction(input: {
  campaignId: string;
  templateId: string;
  targetContactIds: string[];
}): Promise<Result> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "email:send")) return { error: "Permission refusée" };

  const access = await getCampaignAccess(input.campaignId, session.workspaceId);
  if (!access?.canContribute) return { error: "Campagne introuvable ou en lecture seule" };
  const campaign = await db.campaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true, name: true, workspaceId: true },
  });
  if (!campaign) return { error: "Campagne introuvable" };

  const template = await db.emailTemplate.findFirst({
    where: { id: input.templateId, campaignId: input.campaignId },
  });
  if (!template) return { error: "Modèle introuvable" };

  const targets = await db.contact.findMany({
    where: { id: { in: input.targetContactIds }, workspaceId: campaign.workspaceId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      title: true,
      institution: true,
      email: true,
    },
  });

  const blast = await db.emailBlast.create({
    data: {
      campaignId: input.campaignId,
      templateId: template.id,
      subject: renderTemplate(template.subject, {
        campaign_name: campaign.name,
        constituent_name: session.user.name,
      }),
      body: template.body,
      source: "INTERNAL",
      createdById: session.user.id,
    },
  });

  let sent = 0;
  let failed = 0;

  // Envoie en parallèle pour ne pas sérialiser les délais du fournisseur.
  const results = await Promise.allSettled(
    targets
      .filter((t) => t.email)
      .map(async (t) => {
        const ctx = {
          ...contactContext(t),
          campaign_name: campaign.name,
          constituent_name: session.user.name,
          constituent_city: "",
        };
        const result = await dispatchEmail({
          to: t.email!,
          subject: renderTemplate(template.subject, ctx),
          html: wrapEmailHtml(renderTemplate(template.body, ctx), session.user.name),
        });
        await db.sentEmail.create({
          data: {
            blastId: blast.id,
            contactId: t.id,
            senderName: session.user.name,
            subject: renderTemplate(template.subject, ctx),
            body: template.body,
            status: result.ok ? "SENT" : "FAILED",
            providerId: result.ok ? result.providerId : null,
            error: result.ok ? null : result.error,
          },
        });
        return result.ok;
      }),
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) sent++;
    else failed++;
  }

  revalidatePath(`/campaigns/${input.campaignId}/emails`);
  return { ok: true, sent, failed };
}

// ── Interpellation citoyenne publique ────────────────────────────────────────

const CITIZEN_LIMIT_PER_DAY = 40;
const MAX_NAME = 80;
const MAX_CITY = 80;
const MAX_REGION = 80;
const MAX_SUBJECT = 200;
const MAX_BODY = 8000;

export async function citizenSendAction(input: {
  campaignSlug: string;
  name: string;
  city: string;
  email: string;
  region?: string;
  subjectOverride?: string;
  bodyOverride?: string;
  targetContactId?: string;
}): Promise<
  | { ok: true; simulated: boolean; recipientCount: number }
  | { error: string }
> {
  // Limite chaque adresse IP à cinq interpellations par minute.
  const rl = rateLimit(`citizen-send:${await clientIp()}`, 5);
  if (!rl.allowed)
    return { error: `Trop d'envois. Réessayez dans ${rl.retryAfterSec}s.` };

  const name = input.name.trim().slice(0, MAX_NAME);
  const city = input.city.trim().slice(0, MAX_CITY);
  const region = input.region?.trim().slice(0, MAX_REGION) || "";
  if (name.length < 2) return { error: "Votre nom est requis." };
  if (!city) return { error: "Votre ville est requise." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
    return { error: "Adresse email invalide." };

  // Limite les textes libres stockés en base et envoyés par email.
  const subjectOverride = input.subjectOverride?.trim().slice(0, MAX_SUBJECT) || undefined;
  const bodyOverride = input.bodyOverride?.trim().slice(0, MAX_BODY) || undefined;

  const campaign = await db.campaign.findFirst({
    where: { slug: input.campaignSlug },
    select: { id: true, name: true, status: true, workspaceId: true },
  });
  if (!campaign || campaign.status === "ARCHIVED")
    return { error: "Campagne introuvable." };

  // Limite également les envois par auteur sur vingt-quatre heures.
  const recent = await db.sentEmail.count({
    where: {
      senderName: name,
      createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
    },
  });
  if (recent >= CITIZEN_LIMIT_PER_DAY)
    return { error: "Limite d'envoi atteinte pour aujourd'hui. Merci de revenir demain." };

  const templates = await db.emailTemplate.findMany({
    where: { campaignId: campaign.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  const template = templates[0];
  if (!template) return { error: "Aucun modèle configuré pour cette campagne." };

  // Utilise la cible choisie ou les contacts joignables du tableau. Une région
  // privilégie les territoires correspondants, avec repli sur toutes les cibles.
  const cards = await db.kanbanCard.findMany({
    where: { campaignId: campaign.id },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          institution: true,
          email: true,
          region: true,
        },
      },
    },
  });
  let pool = input.targetContactId
    ? cards.filter((c) => c.contact.id === input.targetContactId && c.contact.email)
    : cards.filter((c) => c.contact.email);
  if (!input.targetContactId && region) {
    const nRegion = normalizeFr(region);
    const local = pool.filter(
      (c) =>
        c.contact.region &&
        (normalizeFr(c.contact.region).includes(nRegion) ||
          nRegion.includes(normalizeFr(c.contact.region))),
    );
    if (local.length > 0) pool = local;
  }
  const targets = pool.map((c) => c.contact);
  if (!targets.length) return { error: "Aucune cible joignable pour cette campagne." };

  const blast = await db.emailBlast.create({
    data: {
      campaignId: campaign.id,
      templateId: template.id,
      subject: subjectOverride || template.subject,
      body: bodyOverride || template.body,
      source: "PUBLIC_PAGE",
    },
  });

  // Applique le même parallélisme que pour les envois internes.
  const sendable = targets.filter((t) => t.email);
  await Promise.allSettled(
    sendable.map(async (t) => {
      const ctx = {
        ...contactContext(t),
        campaign_name: campaign.name,
        constituent_name: name,
        constituent_city: city,
      };
      const subject =
        subjectOverride && subjectOverride !== template.subject
          ? subjectOverride
          : renderTemplate(template.subject, ctx);
      const body =
        bodyOverride && bodyOverride !== template.body
          ? bodyOverride
          : renderTemplate(template.body, ctx);
      const result = await dispatchEmail({
        to: t.email!,
        subject,
        html: wrapEmailHtml(body, `${name} — citoyen·ne · ${city}`),
      });
      await db.sentEmail.create({
        data: {
          blastId: blast.id,
          contactId: t.id,
          userId: null,
          senderName: name,
          senderCity: city,
          subject,
          body,
          status: result.ok ? "SENT" : "FAILED",
          providerId: result.ok ? result.providerId : null,
          error: result.ok ? null : result.error,
        },
      });
      return result.ok;
    }),
  );

  // Enregistre le citoyen comme soutien et ajoute son territoire aux tags.
  await upsertSupporter({
    email: input.email,
    name,
    city,
    workspaceId: campaign.workspaceId,
    source: "interpellation",
    tags: region ? [`region:${region.replace(/,/g, " ")}`] : undefined,
  }).catch(() => {});

  return {
    ok: true,
    simulated: !process.env.RESEND_API_KEY,
    recipientCount: sendable.length,
  };
}

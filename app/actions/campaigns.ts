"use server";

/**
 * Campaigns & Kanban pipeline.
 *
 * Card moves are optimistic on the client and normalized here in a
 * transaction: positions are re-sequenced within the destination column and a
 * CardEvent row is appended so every status change is auditable (see the
 * "Activité" panel).
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { slugify } from "@/lib/utils";

// ── Campaigns ────────────────────────────────────────────────────────────────

export async function createCampaignAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; campaignId?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "campaign:create"))
    return { error: "Permission refusée" };

  const name = String(formData.get("name") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "📣").slice(0, 4) || "📣";
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  if (name.length < 3) return { error: "Nom de campagne trop court" };

  let slug = slugify(name) || `campagne-${Date.now()}`;
  if (
    await db.campaign.findFirst({
      where: { workspaceId: session.workspaceId, slug },
    })
  ) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const campaign = await db.campaign.create({
    data: {
      workspaceId: session.workspaceId,
      name,
      slug,
      emoji,
      description: description || null,
      priority,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      createdById: session.user.id,
      stages: {
        create: [
          { name: "À contacter", kind: "NEUTRAL", position: 0 },
          { name: "Email envoyé", kind: "ACTIVE", position: 1 },
          { name: "Rendez-vous programmé", kind: "ACTIVE", position: 2 },
          { name: "Allié·e confirmé·e", kind: "POSITIVE", position: 3 },
          { name: "Officiellement gagné·e", kind: "WON", position: 4 },
          { name: "Opposant·e déclaré·e", kind: "NEGATIVE", position: 5 },
        ],
      },
    },
  });

  revalidatePath("/campaigns");
  return { ok: true, campaignId: campaign.id };
}

export async function updateCampaignStatusAction(
  campaignId: string,
  status: string,
) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "campaign:edit")) throw new Error("Permission refusée");
  await db.campaign.updateMany({
    where: { id: campaignId, workspaceId: session.workspaceId },
    data: { status },
  });
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function deleteCampaignAction(campaignId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "campaign:delete"))
    throw new Error("Permission refusée");
  await db.campaign.deleteMany({
    where: { id: campaignId, workspaceId: session.workspaceId },
  });
  revalidatePath("/campaigns");
}

// ── Kanban cards ─────────────────────────────────────────────────────────────

async function loadCampaignContext(campaignId: string, workspaceId: string) {
  return db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: {
      id: true,
      stages: { orderBy: { position: "asc" }, select: { id: true, name: true } },
    },
  });
}

export async function createCardAction(input: {
  campaignId: string;
  contactId: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "card:create")) throw new Error("Permission refusée");

  const campaign = await loadCampaignContext(
    input.campaignId,
    session.workspaceId,
  );
  if (!campaign) throw new Error("Campagne introuvable");

  const contact = await db.contact.findFirst({
    where: { id: input.contactId, workspaceId: session.workspaceId },
    select: { firstName: true, lastName: true },
  });
  if (!contact) throw new Error("Contact introuvable");

  const existing = await db.kanbanCard.findUnique({
    where: { campaignId_contactId: { campaignId: input.campaignId, contactId: input.contactId } },
  });
  if (existing) return;

  const firstStage = campaign.stages[0];
  if (!firstStage) throw new Error("Aucune étape dans ce pipeline");

  const count = await db.kanbanCard.count({ where: { stageId: firstStage.id } });
  const card = await db.kanbanCard.create({
    data: {
      campaignId: input.campaignId,
      stageId: firstStage.id,
      contactId: input.contactId,
      lastTouchAt: new Date(),
      position: count,
    },
  });
  await db.cardEvent.create({
    data: {
      cardId: card.id,
      actorName: session.user.name,
      kind: "CREATED",
      toStage: firstStage.name,
      detail: `${contact.firstName} ${contact.lastName} ajouté·e au pipeline`,
    },
  });
  revalidatePath(`/campaigns/${input.campaignId}/kanban`);
}

export async function moveCardAction(input: {
  cardId: string;
  toStageId: string;
  position: number;
}): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "card:move")) return { error: "Permission refusée" };

  const card = await db.kanbanCard.findFirst({
    where: { id: input.cardId, campaign: { workspaceId: session.workspaceId } },
    include: {
      stage: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      campaign: {
        select: {
          id: true,
          stages: { select: { id: true, name: true, position: true } },
        },
      },
    },
  });
  if (!card) return { error: "Carte introuvable" };
  const targetStage = card.campaign.stages.find((s) => s.id === input.toStageId);
  if (!targetStage) return { error: "Étape introuvable" };
  if (targetStage.id === card.stageId && input.position === card.position) {
    return { ok: true };
  }

  await db.$transaction(async (tx) => {
    await tx.kanbanCard.update({
      where: { id: input.cardId },
      data: { stageId: input.toStageId, position: input.position, lastTouchAt: new Date() },
    });
    // Normalize sibling positions within the destination column
    const siblings = await tx.kanbanCard.findMany({
      where: { stageId: input.toStageId, NOT: { id: input.cardId } },
      orderBy: [{ position: "asc" }, { lastTouchAt: "desc" }],
      select: { id: true },
    });
    siblings.splice(Math.min(input.position, siblings.length), 0, { id: input.cardId });
    for (let i = 0; i < siblings.length; i++) {
      await tx.kanbanCard.update({
        where: { id: siblings[i]!.id },
        data: { position: i },
      });
    }
    if (card.stageId !== input.toStageId) {
      await tx.cardEvent.create({
        data: {
          cardId: input.cardId,
          actorName: session.user.name,
          kind: "MOVED",
          fromStage: card.stage.name,
          toStage: targetStage.name,
          detail: `${card.contact.firstName} ${card.contact.lastName} : ${card.stage.name} → ${targetStage.name}`,
        },
      });
    }
  });

  revalidatePath(`/campaigns/${card.campaign.id}/kanban`);
  return { ok: true };
}

export async function setCardPriorityAction(cardId: string, priority: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "card:edit")) throw new Error("Permission refusée");
  const card = await db.kanbanCard.findFirst({
    where: { id: cardId, campaign: { workspaceId: session.workspaceId } },
  });
  if (!card) throw new Error("Carte introuvable");
  await db.kanbanCard.update({ where: { id: cardId }, data: { priority } });
  await db.cardEvent.create({
    data: {
      cardId,
      actorName: session.user.name,
      kind: "PRIORITY_CHANGED",
      detail: `Priorité → ${priority}`,
    },
  });
  revalidatePath(`/campaigns/${card.campaignId}/kanban`);
}

export async function assignCardAction(cardId: string, userId: string | null) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "card:edit")) throw new Error("Permission refusée");
  const card = await db.kanbanCard.findFirst({
    where: { id: cardId, campaign: { workspaceId: session.workspaceId } },
  });
  if (!card) throw new Error("Carte introuvable");
  await db.kanbanCard.update({
    where: { id: cardId },
    data: { assignedToId: userId, lastTouchAt: new Date() },
  });
  revalidatePath(`/campaigns/${card.campaignId}/kanban`);
}

export async function removeCardAction(cardId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "card:delete")) throw new Error("Permission refusée");
  const card = await db.kanbanCard.findFirst({
    where: { id: cardId, campaign: { workspaceId: session.workspaceId } },
  });
  if (!card) throw new Error("Carte introuvable");
  await db.kanbanCard.delete({ where: { id: cardId } });
  revalidatePath(`/campaigns/${card.campaignId}/kanban`);
}

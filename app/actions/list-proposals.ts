"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export type ProposalAction = "ADD" | "UPDATE" | "REMOVE" | "ATTRIBUTE";

const personSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  phone: z.string().trim().max(40).nullable().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  institution: z.string().trim().max(160).nullable().optional(),
  party: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  level: z.enum([
    "EU",
    "NATIONAL",
    "REGIONAL",
    "LOCAL",
    "PRIVATE_SECTOR",
    "MEDIA",
    "CIVIL_SOCIETY",
  ]).optional(),
  stance: z.enum(["ALLY", "FAVORABLE", "UNDECIDED", "TARGET", "OPPOSED", "UNKNOWN"]).optional(),
  influenceScore: z.number().int().min(1).max(5).optional(),
  bio: z.string().trim().max(4000).nullable().optional(),
  themes: z.string().trim().max(300).nullable().optional(),
  photoUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  note: z.string().trim().max(300).nullable().optional(),
});

const attributeSchema = z.object({
  fieldId: z.string().min(1),
  value: z.string().max(300).optional(),
}).strict();

function parsePayload(action: ProposalAction, payload: unknown) {
  if (action === "ATTRIBUTE") return attributeSchema.parse(payload);
  return personSchema.parse(payload);
}

/** Enregistre une proposition membre en l'isolant strictement à sa session. */
export async function proposeListChange(input: {
  listId: string;
  action: ProposalAction;
  contactId?: string;
  payload: unknown;
  reason?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role === "OBSERVER") throw new Error("Permission refusée");

  const list = await db.sharedList.findFirst({
    where: { id: input.listId, workspaceId: session.workspaceId, sourcePack: { not: null } },
    select: { id: true },
  });
  if (!list) throw new Error("Liste de référence introuvable");

  const payload = parsePayload(input.action, input.payload);
  const serializedPayload = JSON.stringify(payload);
  if (input.contactId) {
    const contact = await db.contact.findFirst({
      where: { id: input.contactId, workspaceId: session.workspaceId },
      select: { id: true },
    });
    if (!contact) throw new Error("Contact introuvable");
  }

  const duplicate = await db.listChangeProposal.findFirst({
    where: {
      listId: input.listId,
      contactId: input.contactId ?? null,
      action: input.action,
      status: "PENDING",
      origin: "MEMBER",
      ...(!input.contactId ? { payload: serializedPayload } : {}),
    },
    select: { id: true },
  });
  if (duplicate) return { ok: true, duplicate: true };

  await db.listChangeProposal.create({
    data: {
      listId: input.listId,
      workspaceId: session.workspaceId,
      authorId: session.user.id,
      action: input.action,
      contactId: input.contactId ?? null,
      payload: serializedPayload,
      reason: input.reason?.trim().slice(0, 300) || null,
      origin: "MEMBER",
    },
  });
  revalidatePath("/lists");
  return { ok: true, duplicate: false };
}

export async function approveListChangeProposalAction(proposalId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  await db.$transaction(async (tx) => {
    const proposal = await tx.listChangeProposal.findFirst({
      where: { id: proposalId, workspaceId: session.workspaceId, status: "PENDING" },
      include: { list: { select: { id: true, sourcePack: true } } },
    });
    if (!proposal?.list.sourcePack) {
      throw new Error("Proposition introuvable ou déjà traitée");
    }
    const action = proposal.action as ProposalAction;
    const payload = parsePayload(action, JSON.parse(proposal.payload) as unknown);

    const claimed = await tx.listChangeProposal.updateMany({
      where: { id: proposal.id, status: "PENDING" },
      data: { status: "APPROVED", reviewerId: session.user.id, reviewedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("Proposition déjà traitée");

    if (action === "ADD") {
      let contactId = proposal.contactId;
      if (contactId) {
        const contact = await tx.contact.findFirst({
          where: { id: contactId, workspaceId: session.workspaceId },
          select: { id: true },
        });
        if (!contact) throw new Error("Contact introuvable");
      } else {
        const person = personSchema.parse(payload);
        const existing = await tx.contact.findFirst({
          where: {
            workspaceId: session.workspaceId,
            firstName: person.firstName,
            lastName: person.lastName,
            institution: person.institution || null,
          },
          select: { id: true },
        });
        contactId = existing?.id ?? null;
        if (!contactId) {
          const created = await tx.contact.create({
            data: {
              workspaceId: session.workspaceId,
              firstName: person.firstName,
              lastName: person.lastName,
              email: person.email || null,
              phone: person.phone || null,
              title: person.title || null,
              institution: person.institution || null,
              party: person.party || null,
              region: person.region || null,
              level: person.level ?? "NATIONAL",
              stance: person.stance ?? "UNKNOWN",
              influenceScore: person.influenceScore ?? 3,
              bio: person.bio || null,
              themes: person.themes || null,
              photoUrl: person.photoUrl || null,
              category: "DECISION_MAKER",
              createdById: proposal.authorId,
            },
            select: { id: true },
          });
          contactId = created.id;
        }
      }
      await tx.listItem.upsert({
        where: { listId_contactId: { listId: proposal.listId, contactId } },
        create: {
          listId: proposal.listId,
          contactId,
          note: "note" in payload ? payload.note || null : null,
        },
        update: {},
      });
    } else {
      if (!proposal.contactId) throw new Error("Contact manquant dans la proposition");
      const item = await tx.listItem.findFirst({
        where: { listId: proposal.listId, contactId: proposal.contactId },
        select: { id: true, contact: { select: { workspaceId: true } } },
      });
      if (!item || item.contact.workspaceId !== session.workspaceId) {
        throw new Error("Contact absent de la liste");
      }

      if (action === "UPDATE") {
        const person = personSchema.parse(payload);
        await tx.contact.update({
          where: { id: proposal.contactId },
          data: {
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email || null,
            phone: person.phone === undefined ? undefined : (person.phone || null),
            title: person.title || null,
            institution: person.institution || null,
            party: person.party || null,
            region: person.region || null,
            level: person.level,
            stance: person.stance,
            influenceScore: person.influenceScore,
            bio: person.bio === undefined ? undefined : (person.bio || null),
            themes: person.themes === undefined ? undefined : (person.themes || null),
            photoUrl: person.photoUrl === undefined ? undefined : (person.photoUrl || null),
          },
        });
      } else if (action === "REMOVE") {
        await tx.listItem.delete({ where: { id: item.id } });
      } else if (action === "ATTRIBUTE") {
        const attribute = attributeSchema.parse(payload);
        const field = await tx.customField.findFirst({
          where: {
            id: attribute.fieldId,
            listId: proposal.listId,
            workspaceId: session.workspaceId,
          },
          select: { id: true },
        });
        if (!field) throw new Error("Attribut introuvable");
        await tx.customFieldValue.upsert({
          where: { fieldId_contactId: { fieldId: field.id, contactId: proposal.contactId } },
          create: {
            fieldId: field.id,
            contactId: proposal.contactId,
            value: attribute.value?.trim() || null,
          },
          update: { value: attribute.value?.trim() || null },
        });
      }
    }
  });

  revalidatePath("/lists");
  revalidatePath("/contacts");
  return { ok: true };
}

export async function rejectListChangeProposalAction(proposalId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.role !== "ADMIN") throw new Error("Réservé aux administrateurs");
  await db.listChangeProposal.updateMany({
    where: { id: proposalId, workspaceId: session.workspaceId, status: "PENDING" },
    data: { status: "REJECTED", reviewerId: session.user.id, reviewedAt: new Date() },
  });
  revalidatePath("/lists");
  return { ok: true };
}

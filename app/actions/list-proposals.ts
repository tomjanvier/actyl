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
  sourceSystem: z.string().trim().max(80).nullable().optional(),
  sourceId: z.string().trim().max(160).nullable().optional(),
  facebookUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  instagramUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  youtubeUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  mastodonUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
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
  if (!session.user.isSuperAdmin) throw new Error("Réservé au super-administrateur");

  await db.$transaction(async (tx) => {
    const proposal = await tx.listChangeProposal.findFirst({
      where: { id: proposalId, status: "PENDING" },
      include: { list: { select: { id: true, sourcePack: true, workspaceId: true } } },
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

    if (action === "ATTRIBUTE") {
      if (!proposal.contactId) throw new Error("Contact manquant dans la proposition");
        const attribute = attributeSchema.parse(payload);
        const field = await tx.customField.findFirst({
          where: {
            id: attribute.fieldId,
            listId: proposal.listId,
            workspaceId: proposal.workspaceId,
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
      return;
    }

    const person = personSchema.parse(payload);
    const sourceContact = proposal.contactId
      ? await tx.contact.findUnique({
          where: { id: proposal.contactId },
          select: {
            firstName: true,
            lastName: true,
            institution: true,
            sourceSystem: true,
            sourceId: true,
          },
        })
      : null;
    const referenceLists = await tx.sharedList.findMany({
      where: { sourcePack: proposal.list.sourcePack },
      select: { id: true, workspaceId: true },
    });

    for (const referenceList of referenceLists) {
      const identity = sourceContact ?? person;
      let contact =
        identity.sourceSystem && identity.sourceId
          ? await tx.contact.findFirst({
              where: {
                workspaceId: referenceList.workspaceId,
                sourceSystem: identity.sourceSystem,
                sourceId: identity.sourceId,
              },
              select: { id: true },
            })
          : null;
      contact ??= await tx.contact.findFirst({
          where: {
            workspaceId: referenceList.workspaceId,
            firstName: identity.firstName,
            lastName: identity.lastName,
            institution: identity.institution || null,
          },
          select: { id: true },
        });

      if (action === "ADD") {
        if (!contact) {
          contact = await tx.contact.create({
            data: {
              workspaceId: referenceList.workspaceId,
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
              sourceSystem: person.sourceSystem || null,
              sourceId: person.sourceId || null,
              facebookUrl: person.facebookUrl || null,
              instagramUrl: person.instagramUrl || null,
              youtubeUrl: person.youtubeUrl || null,
              mastodonUrl: person.mastodonUrl || null,
              category: "DECISION_MAKER",
              createdById: proposal.authorId,
            },
            select: { id: true },
          });
        }
        await tx.listItem.upsert({
          where: {
            listId_contactId: { listId: referenceList.id, contactId: contact.id },
          },
          create: {
            listId: referenceList.id,
            contactId: contact.id,
            note: person.note || null,
          },
          update: {},
        });
      } else if (action === "UPDATE" && contact) {
        await tx.contact.update({
          where: { id: contact.id },
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
            sourceSystem:
              person.sourceSystem === undefined ? undefined : person.sourceSystem,
            sourceId: person.sourceId === undefined ? undefined : person.sourceId,
            facebookUrl:
              person.facebookUrl === undefined ? undefined : (person.facebookUrl || null),
            instagramUrl:
              person.instagramUrl === undefined ? undefined : (person.instagramUrl || null),
            youtubeUrl:
              person.youtubeUrl === undefined ? undefined : (person.youtubeUrl || null),
            mastodonUrl:
              person.mastodonUrl === undefined ? undefined : (person.mastodonUrl || null),
          },
        });
      } else if (action === "REMOVE" && contact) {
        await tx.listItem.deleteMany({
          where: { listId: referenceList.id, contactId: contact.id },
        });
      }
    }

    // Une validation globale clôt les doublons créés pour les autres espaces.
    await tx.listChangeProposal.updateMany({
      where: {
        status: "PENDING",
        action: proposal.action,
        payload: proposal.payload,
        list: { sourcePack: proposal.list.sourcePack },
      },
      data: {
        status: "APPROVED",
        reviewerId: session.user.id,
        reviewedAt: new Date(),
      },
    });
  });

  revalidatePath("/lists");
  revalidatePath("/contacts");
  return { ok: true };
}

export async function rejectListChangeProposalAction(proposalId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!session.user.isSuperAdmin) throw new Error("Réservé au super-administrateur");
  await db.listChangeProposal.updateMany({
    where: { id: proposalId, status: "PENDING" },
    data: { status: "REJECTED", reviewerId: session.user.id, reviewedAt: new Date() },
  });
  revalidatePath("/lists");
  return { ok: true };
}

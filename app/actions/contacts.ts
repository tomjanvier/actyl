"use server";

/**
 * Contacts et modèle de connaissance à trois niveaux : champs partagés,
 * notes collectives et données privées propres à chaque membre.
 * Chaque mutation vérifie les droits et l'espace actif de la session.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { proposeListChange } from "@/app/actions/list-proposals";

const contactSchema = z.object({
  firstName: z.string().min(1, "Prénom requis").max(80),
  lastName: z.string().min(1, "Nom requis").max(80),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  title: z.string().max(120).optional().or(z.literal("")),
  institution: z.string().max(160).optional().or(z.literal("")),
  party: z.string().max(120).optional().or(z.literal("")),
  region: z.string().max(120).optional().or(z.literal("")),
  level: z.enum([
    "EU", "NATIONAL", "REGIONAL", "LOCAL",
    "PRIVATE_SECTOR", "MEDIA", "CIVIL_SOCIETY",
  ]),
  stance: z.enum(["ALLY", "FAVORABLE", "UNDECIDED", "TARGET", "OPPOSED", "UNKNOWN"]),
  influenceScore: z.coerce.number().int().min(1).max(5).default(3),
  bio: z.string().max(4000).optional().or(z.literal("")),
  themes: z.string().max(300).optional().or(z.literal("")),
  photoUrl: z.string().url("URL invalide").optional().or(z.literal("")),
});

export async function createContactAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "contact:create")) return { error: "Permission refusée" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;
  const colorPool = ["indigo", "emerald", "amber", "rose", "violet", "sky", "teal", "orange", "fuchsia", "slate"];

  // Segment facultatif validé dans la liste fermée des valeurs acceptées.
  const CATEGORY_VALUES = ["DECISION_MAKER", "MEMBER", "VOLUNTEER", "DONOR", "SUPPORTER"];
  const rawCategory = String(formData.get("category") ?? "");
  const category = CATEGORY_VALUES.includes(rawCategory) ? rawCategory : "DECISION_MAKER";

  await db.contact.create({
    data: {
      workspaceId: session.workspaceId,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email || null,
      phone: d.phone || null,
      title: d.title || null,
      institution: d.institution || null,
      party: d.party || null,
      region: d.region || null,
      level: d.level,
      stance: d.stance,
      influenceScore: d.influenceScore,
      bio: d.bio || null,
      themes: d.themes || null,
      photoUrl: d.photoUrl || null,
      category,
      avatarColor: colorPool[Math.floor(Math.random() * colorPool.length)]!,
      createdById: session.user.id,
    },
  });
  revalidatePath("/contacts");
  return { ok: true };
}

export async function updateContactAction(
  contactId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "contact:edit")) return { error: "Permission refusée" };

  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId: session.workspaceId },
  });
  if (!contact) return { error: "Contact introuvable" };

  const referenceLists = await db.sharedList.findMany({
    where: { workspaceId: session.workspaceId, sourcePack: { not: null }, items: { some: { contactId } } },
    select: { id: true, name: true },
  });

  const raw = Object.fromEntries(formData.entries());
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;
  if (referenceLists.length && session.role !== "ADMIN") {
    await Promise.all(referenceLists.map((referenceList) =>
      proposeListChange({
        listId: referenceList.id,
        action: "UPDATE",
        contactId,
        payload: { ...d, note: "Modification proposée par un membre" },
        reason: `Modification proposée dans « ${referenceList.name} »`,
      }),
    ));
    revalidatePath("/lists");
    return { ok: true };
  }
  await db.contact.update({
    where: { id: contactId },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email || null,
      phone: d.phone || null,
      title: d.title || null,
      institution: d.institution || null,
      party: d.party || null,
      region: d.region || null,
      level: d.level,
      stance: d.stance,
      influenceScore: d.influenceScore,
      bio: d.bio || null,
      themes: d.themes || null,
      photoUrl: d.photoUrl || null,
    },
  });
  revalidatePath("/contacts");
  revalidatePath(`/campaigns`);
  return { ok: true };
}

export async function deleteContactAction(contactId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!can(session.role, "campaign:delete")) throw new Error("Permission refusée");
  const referenceLists = await db.sharedList.findMany({
    where: {
      workspaceId: session.workspaceId,
      sourcePack: { not: null },
      items: { some: { contactId } },
    },
    select: { id: true, name: true },
  });
  if (referenceLists.length && session.role !== "ADMIN") {
    const contact = await db.contact.findFirst({
      where: { id: contactId, workspaceId: session.workspaceId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        title: true,
        institution: true,
        party: true,
        region: true,
        level: true,
      },
    });
    if (!contact) throw new Error("Contact introuvable");
    await Promise.all(referenceLists.map((list) =>
      proposeListChange({
        listId: list.id,
        action: "REMOVE",
        contactId,
        payload: contact,
        reason: `Suppression proposée depuis « ${list.name} »`,
      }),
    ));
    revalidatePath("/lists");
    return { proposed: referenceLists.length };
  }
  await db.contact.deleteMany({
    where: { id: contactId, workspaceId: session.workspaceId },
  });
  revalidatePath("/contacts");
}

// ── Couche privée visible uniquement par l'auteur ───────────────────────────

export async function addPrivateNoteAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "note:add")) return { error: "Permission refusée" };

  const contactId = String(formData.get("contactId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!contactId || !body) return { error: "Note vide" };

  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId: session.workspaceId },
  });
  if (!contact) return { error: "Contact introuvable" };

  await db.privateNote.create({
    data: { contactId, authorId: session.user.id, body },
  });
  revalidatePath("/contacts");
  return { ok: true };
}

export async function savePrivateDataAction(input: {
  contactId: string;
  rating: number | null;
  tags: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  const contact = await db.contact.findFirst({
    where: { id: input.contactId, workspaceId: session.workspaceId },
  });
  if (!contact) return { error: "Contact introuvable" };

  await db.contactPrivateData.upsert({
    where: { contactId_userId: { contactId: input.contactId, userId: session.user.id } },
    create: {
      contactId: input.contactId,
      userId: session.user.id,
      rating: input.rating,
      tags: input.tags || null,
    },
    update: { rating: input.rating, tags: input.tags || null },
  });
  revalidatePath("/contacts");
  return { ok: true };
}

// ── Notes collectives de l'espace ────────────────────────────────────────────

export async function addOrgNoteAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (session.role === "OBSERVER") return { error: "Permission refusée" };

  const contactId = String(formData.get("contactId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!contactId || !body) return { error: "Note vide" };

  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId: session.workspaceId },
  });
  if (!contact) return { error: "Contact introuvable" };

  await db.orgNote.create({
    data: {
      contactId,
      workspaceId: session.workspaceId,
      authorId: session.user.id,
      authorName: session.user.name,
      body,
    },
  });
  revalidatePath("/contacts");
  return { ok: true };
}

export async function deleteOrgNoteAction(noteId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  await db.orgNote.deleteMany({
    where: {
      id: noteId,
      workspaceId: session.workspaceId,
      ...(session.role === "ADMIN" ? {} : { authorId: session.user.id }),
    },
  });
  revalidatePath("/contacts");
}

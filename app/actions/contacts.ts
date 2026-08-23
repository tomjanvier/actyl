"use server";

/**
 * Contacts: CRUD on decision-makers + the three-layer knowledge model:
 *   1. Shared fields (this file) — visible to the whole workspace
 *   2. Org notes (addOrgNoteAction) — collective, workspace-visible notes
 *   3. Private layer (notes/rating/tags) — strictly per-user
 *
 * Every mutation is permission-checked via `can(role, action)` and scoped to
 * the caller's active workspace to prevent cross-tenant access.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";

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

  // Extended directory: optional segment (validated against the known list).
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

  const raw = Object.fromEntries(formData.entries());
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const d = parsed.data;
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
  await db.contact.deleteMany({
    where: { id: contactId, workspaceId: session.workspaceId },
  });
  revalidatePath("/contacts");
}

// ── Private layer (visible only to the author) ──────────────────────────────

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

// ── Collective workspace-level notes ─────────────────────────────────────────

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

// ── Election campaign team import ────────────────────────────────────────────

const ELECTION_TYPES = [
  "PRESIDENTIELLE",
  "LEGISLATIVES",
  "MUNICIPALES",
  "DEPARTEMENTALES",
  "REGIONALES",
  "EUROPEENNES",
  "CANTONALES",
  "AUTRE",
] as const;

export async function importCampaignTeamAction(input: {
  candidate: string;
  party?: string;
  election: string;
  region?: string;
  roster: string;
}): Promise<{ ok?: boolean; error?: string; created?: number; skipped?: number }> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "contact:create")) return { error: "Permission refusée" };

  const candidate = input.candidate.trim().slice(0, 120);
  const election = input.election.trim() as (typeof ELECTION_TYPES)[number];
  if (candidate.length < 2) return { error: "Nom du candidat requis." };
  if (!ELECTION_TYPES.includes(election)) return { error: "Type d'élection invalide." };

  const party = input.party?.trim().slice(0, 120) || null;
  const region = input.region?.trim().slice(0, 80) || null;

  // Parse the pasted roster: one person per line, fields separated by ; | tab
  // or em/en dash. Expected shape: "Prénom Nom — Fonction — email" (email &
  // function optional). Phone in 4th position is picked up when present.
  const lines = input.roster.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { error: "Collez au moins une ligne." };
  if (lines.length > 300) return { error: "300 personnes maximum par import." };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const colorPool = ["indigo", "emerald", "amber", "rose", "violet", "sky", "teal", "orange", "fuchsia", "slate"];
  let created = 0;
  let skipped = 0;

  for (const line of lines.slice(0, 300)) {
    const parts = line
      .split(/\s*[;|\t—–-]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) continue;

    // Name is everything before the first email-like token.
    const emailIdx = parts.findIndex((p) => EMAIL_RE.test(p));
    const namePart = (emailIdx === -1 ? parts[0]! : parts.slice(0, emailIdx).join(" ")).trim();
    const email = emailIdx === -1 ? null : parts[emailIdx]!.toLowerCase();

    // Function: first non-name, non-email token.
    const fn = parts.find(
      (p, i) => i !== 0 && p !== parts[emailIdx!] && !EMAIL_RE.test(p),
    );
    const phone = parts.find((p) => /^\+?[\d\s.()-]{8,}$/.test(p) && !EMAIL_RE.test(p));

    const nameWords = namePart.split(/\s+/);
    if (nameWords.length < 2 || nameWords.join("").length < 4) {
      skipped++;
      continue;
    }
    const firstName = nameWords[0]!.slice(0, 80);
    const lastName = nameWords.slice(1).join(" ").slice(0, 80);

    const exists = await db.contact.findFirst({
      where: {
        workspaceId: session.workspaceId,
        firstName,
        lastName,
        institution: `Équipe ${candidate}`,
      },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }

    await db.contact.create({
      data: {
        workspaceId: session.workspaceId,
        firstName,
        lastName,
        email,
        phone: phone ?? null,
        title: fn?.slice(0, 120) ?? "Membre de l'équipe",
        institution: `Équipe ${candidate}`.slice(0, 160),
        party,
        region,
        level: "CIVIL_SOCIETY",
        category: "DECISION_MAKER",
        stance: "ALLY",
        influenceScore: 3,
        themes: `election:${election.toLowerCase()}`,
        avatarColor: colorPool[Math.floor(Math.random() * colorPool.length)]!,
        createdById: session.user.id,
      },
    });
    created++;
  }

  revalidatePath("/contacts");
  if (!created && skipped) return { ok: true, created: 0, skipped };
  return { ok: true, created, skipped };
}

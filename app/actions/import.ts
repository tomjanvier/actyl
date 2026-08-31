"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import {
  importAssembleeNationale,
  importSenat,
  importParlementEuropeen,
  importLocalElectedOfficials,
  importParisCouncillors,
  type ImportedContact,
} from "@/lib/importers/officials";
import {
  mergePeopleIntoList,
  parseContactsCsv,
  norm,
} from "@/lib/lists-import";
import { REFERENCE_PACKS, type ReferencePackKey } from "@/lib/datasets/reference-packs";
import {
  PRESIDENTIELLE_LISTS,
} from "@/lib/datasets/presidentielle-2027";
import { syncReferenceListProposals } from "@/lib/reference-sync";
import { referencePackSettingKey } from "@/lib/reference-pack-settings";
import { ensurePresidentialModuleScope } from "@/lib/presidential-module";

export type ImportResult = {
  ok?: boolean;
  error?: string;
  created?: number;
  linked?: number;
  already?: number;
  skipped?: number;
  proposed?: number;
};

/**
 * Importe une source officielle sans écraser les contacts existants et peut
 * rattacher le résultat à une liste partagée.
 */
async function upsertImported(
  workspaceId: string,
  contacts: ImportedContact[],
  listId?: string | null,
): Promise<Omit<ImportResult, "error" | "ok">> {
  const people = contacts.map((c) => ({
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    photoUrl: c.photoUrl,
    title: c.title,
    institution: c.institution,
    party: c.party,
    region: c.region,
    level: c.level,
    note: null,
  }));
  if (listId) {
    return mergePeopleIntoList(workspaceId, listId, people);
  }
  // Sans liste cible, ajoute uniquement les contacts absents de l'annuaire.
  return mergePeopleIntoDirectory(workspaceId, people);
}

/** Applique les mêmes règles de fusion à la seule table des contacts. */
async function mergePeopleIntoDirectory(
  workspaceId: string,
  people: Array<{
    firstName: string;
    lastName: string;
    email: string | null;
    photoUrl?: string | null;
    title: string | null;
    institution: string | null;
    party: string | null;
    region: string | null;
    level: string;
  }>,
): Promise<Omit<ImportResult, "error" | "ok">> {
  const AVATAR_COLORS = ["slate", "indigo", "emerald", "amber", "rose", "violet", "sky", "teal", "orange", "fuchsia"];
  const existing = await db.contact.findMany({
    where: { workspaceId },
    select: { id: true, firstName: true, lastName: true, institution: true },
  });
  const index = new Set(
    existing.map((c) => `${norm(c.firstName)}|${norm(c.lastName)}|${norm(c.institution)}`),
  );
  let created = 0;
  let skipped = 0;
  let ci = Math.floor(Math.random() * AVATAR_COLORS.length);
  for (const p of people) {
    if (!p.firstName.trim() && !p.lastName.trim()) {
      skipped++;
      continue;
    }
    const key = `${norm(p.firstName)}|${norm(p.lastName)}|${norm(p.institution)}`;
    if (index.has(key)) continue; // Ne modifie jamais une fiche existante.
    await db.contact.create({
      data: {
        workspaceId,
        firstName: p.firstName || "(?)",
        lastName: p.lastName,
        email: p.email,
        photoUrl: p.photoUrl ?? null,
        title: p.title,
        institution: p.institution,
        party: p.party,
        region: p.region,
        level: p.level,
        stance: "UNKNOWN",
        influenceScore: 3,
        avatarColor: AVATAR_COLORS[ci++ % AVATAR_COLORS.length]!,
      },
    });
    index.add(key);
    created++;
  }
  return { created, linked: 0, already: 0, skipped };
}

export async function importOfficialSourceAction(
  source: "an" | "senat" | "pe" | "presidentielle" | "paris" | "regions" | "departements",
  opts?: { listId?: string | null },
): Promise<ImportResult> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "contact:create"))
    return { error: "Permission refusée" };

  try {
    let contacts: ImportedContact[];
    if (source === "an") {
      contacts = await importAssembleeNationale();
    } else if (source === "senat") {
      contacts = await importSenat();
    } else if (source === "pe") {
      contacts = await importParlementEuropeen();
    } else if (source === "presidentielle") {
      contacts = PRESIDENTIELLE_LISTS.flatMap((list) =>
        list.people.map((person) => ({
          firstName: person.firstName,
          lastName: person.lastName,
          email: null,
          photoUrl: null,
          title: person.title,
          institution: "Présidentielle 2027",
          party: person.party,
          region: null,
          level: "NATIONAL",
        })),
      );
    } else if (source === "paris") {
      contacts = await importParisCouncillors();
    } else {
      contacts = await importLocalElectedOfficials(source);
    }

    // Vérifie que la liste cible appartient bien à l'espace actif.
    let listId = opts?.listId ?? null;
    if (listId) {
      const owned = await db.sharedList.findFirst({
        where: { id: listId, workspaceId: session.workspaceId },
        select: { id: true, sourcePack: true },
      });
      if (!owned) listId = null;
      else if (owned.sourcePack && session.role !== "ADMIN") {
        return { error: "Seul l’administrateur peut synchroniser une liste de référence" };
      }
    }

    const stats = await upsertImported(session.workspaceId, contacts, listId);
    revalidatePath("/contacts");
    revalidatePath("/lists");
    revalidatePath("/presidentielle");
    revalidatePath("/settings");
    return { ok: true, ...stats };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Import échoué : ${e.message}`
          : "Import échoué (erreur inconnue)",
    };
  }
}

export async function installReferencePackAction(key: ReferencePackKey): Promise<ImportResult> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (session.role !== "ADMIN") return { error: "Seul l’administrateur peut installer ou synchroniser un pack" };
  const pack = REFERENCE_PACKS.find((candidate) => candidate.key === key);
  if (!pack) return { error: "Pack introuvable" };

  const existing = await db.sharedList.findFirst({
    where: { workspaceId: session.workspaceId, sourcePack: pack.key },
    select: { id: true },
  });
  const nameCollision = existing
    ? null
    : await db.sharedList.findUnique({
        where: { workspaceId_name: { workspaceId: session.workspaceId, name: pack.name } },
        select: { id: true },
      });
  if (nameCollision) {
    return { error: `Une liste nommée « ${pack.name} » existe déjà sans être rattachée à ce pack` };
  }
  const canonicalList = existing
    ? null
    : await db.sharedList.findFirst({
        where: {
          sourcePack: pack.key,
          workspaceId: { not: session.workspaceId },
        },
        orderBy: { createdAt: "asc" },
        select: {
          items: {
            select: {
              note: true,
              contact: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  photoUrl: true,
                  title: true,
                  institution: true,
                  party: true,
                  region: true,
                  level: true,
                },
              },
            },
          },
        },
      });

  await db.appSetting.upsert({
    where: { key: referencePackSettingKey(session.workspaceId, key) },
    create: { key: referencePackSettingKey(session.workspaceId, key), value: "on" },
    update: { value: "on" },
  });
  if (existing) {
    const result = await syncReferenceListProposals(
      existing.id,
      session.workspaceId,
      key,
    );
    if (key === "presidentielle-2027") {
      await ensurePresidentialModuleScope(session.workspaceId, session.user.id);
    }
    revalidatePath("/settings");
    revalidatePath("/lists");
    return { ok: true, proposed: result.proposals };
  }

  const list = await db.sharedList.create({
    data: {
      workspaceId: session.workspaceId,
      name: pack.name,
      description: pack.description,
      sourcePack: pack.key,
      createdById: session.user.id,
    },
    select: { id: true },
  });
  const result = canonicalList
    ? {
        ok: true as const,
        ...(await mergePeopleIntoList(
          session.workspaceId,
          list.id,
          canonicalList.items.map((item) => ({
            ...item.contact,
            note: item.note,
          })),
        )),
      }
    : await importOfficialSourceAction(pack.source, { listId: list.id });
  if (result.error) {
    // Ne conserve pas une liste vide lorsque la première récupération échoue.
    await db.sharedList.deleteMany({
      where: { id: list.id, workspaceId: session.workspaceId, items: { none: {} } },
    });
    await db.appSetting.update({
      where: { key: referencePackSettingKey(session.workspaceId, key) },
      data: { value: "off" },
    });
  } else if (key === "presidentielle-2027") {
    await ensurePresidentialModuleScope(session.workspaceId, session.user.id);
  }
  return result;
}

/** Active ou masque un référentiel partagé sans supprimer ses données. */
export async function setReferencePackEnabledAction(
  key: ReferencePackKey,
  enabled: boolean,
): Promise<ImportResult> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (session.role !== "ADMIN") {
    return { error: "Seul l’administrateur peut activer un référentiel" };
  }
  if (!REFERENCE_PACKS.some((pack) => pack.key === key)) {
    return { error: "Référentiel introuvable" };
  }
  if (enabled) return installReferencePackAction(key);

  await db.appSetting.upsert({
    where: { key: referencePackSettingKey(session.workspaceId, key) },
    create: { key: referencePackSettingKey(session.workspaceId, key), value: "off" },
    update: { value: "off" },
  });
  await db.sharedList.updateMany({
    where: { workspaceId: session.workspaceId, sourcePack: key },
    data: { isPublished: false },
  });
  revalidatePath("/settings");
  revalidatePath("/lists");
  revalidatePath("/contacts");
  return { ok: true };
}

/**
 * Importe un CSV dans une liste : rattache l'existant, crée les absents et ne
 * supprime ni ne modifie aucune fiche.
 */
export async function importCsvIntoListAction(input: {
  listId: string;
  csv: string;
}): Promise<
  | ({ ok: true } & Omit<ImportResult, "error" | "ok">)
  | { ok?: false; error?: string }
> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "list:create")) return { error: "Permission refusée" };

  const list = await db.sharedList.findFirst({
    where: { id: input.listId, workspaceId: session.workspaceId },
    select: { id: true, sourcePack: true, createdById: true },
  });
  if (!list) return { error: "Liste introuvable" };
  if (
    (list.sourcePack && !session.user.isSuperAdmin) ||
    (!list.sourcePack &&
      session.role !== "ADMIN" &&
      list.createdById !== session.user.id)
  ) {
    return {
      error: "Vous pouvez importer un CSV uniquement dans une liste que vous avez créée",
    };
  }

  const csv = (input.csv ?? "").trim();
  if (!csv) return { error: "Collez d'abord un CSV (avec ligne d'en-tête)." };

  const people = parseContactsCsv(csv);
  if (people.length === 0) {
    return {
      error:
        "Aucune ligne exploitable : l'en-tête doit contenir au minimum « prénom » ou « nom ».",
    };
  }
  const stats = await mergePeopleIntoList(session.workspaceId, input.listId, people);
  revalidatePath("/lists");
  revalidatePath("/presidentielle");
  return { ok: true, ...stats };
}

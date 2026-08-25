"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import {
  importAssembleeNationale,
  importSenat,
  importParlementEuropeen,
  type ImportedContact,
} from "@/lib/importers/officials";
import {
  mergePeopleIntoList,
  parseContactsCsv,
  norm,
} from "@/lib/lists-import";

export type ImportResult = {
  ok?: boolean;
  error?: string;
  created?: number;
  linked?: number;
  already?: number;
  skipped?: number;
};

/**
 * Import official sources into the directory WITHOUT overwriting existing
 * contacts (merge-only). Optionally attach everything to a shared list.
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
  // Directory-only mode: still no clobber — create missing contacts only.
  return mergePeopleIntoDirectory(workspaceId, people);
}

/** Same merge rules, but only touches the contact table (no list items). */
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
    if (index.has(key)) continue; // never overwrite
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
  source: "an" | "senat" | "pe",
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
    } else {
      contacts = await importParlementEuropeen();
    }

    // If a target list is provided, make sure it belongs to this workspace.
    let listId = opts?.listId ?? null;
    if (listId) {
      const owned = await db.sharedList.findFirst({
        where: { id: listId, workspaceId: session.workspaceId },
        select: { id: true },
      });
      if (!owned) listId = null;
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

/**
 * Paste-CSV import into ONE list — merge semantics: existing contacts are
 * linked, never modified; unknown rows are created; nothing is deleted.
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
    select: { id: true },
  });
  if (!list) return { error: "Liste introuvable" };

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

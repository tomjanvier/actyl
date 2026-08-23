"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  importAssembleeNationale,
  importSenat,
  importParlementEuropeen,
  type ImportedContact,
} from "@/lib/importers/officials";

export type ImportResult = {
  ok?: boolean;
  error?: string;
  created?: number;
  updated?: number;
  skipped?: number;
};

async function upsertImported(
  workspaceId: string,
  contacts: ImportedContact[],
): Promise<Omit<ImportResult, "error" | "ok">> {
  const colors = ["slate", "indigo", "emerald", "amber", "rose", "violet", "sky", "teal", "orange", "fuchsia"];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let ci = Math.floor(Math.random() * colors.length);

  for (const c of contacts) {
    if (!c.firstName && !c.lastName) {
      skipped++;
      continue;
    }
    const existing = await db.contact.findFirst({
      where: {
        workspaceId,
        firstName: c.firstName,
        lastName: c.lastName,
        institution: c.institution,
      },
      select: { id: true },
    });
    const data = {
      email: c.email,
      photoUrl: c.photoUrl,
      title: c.title,
      party: c.party,
      region: c.region,
      level: c.level,
      influenceScore: 3,
    };
    if (existing) {
      await db.contact.update({
        where: { id: existing.id },
        data: { ...data, updatedAt: new Date() },
      });
      updated++;
    } else {
      await db.contact.create({
        data: {
          workspaceId,
          firstName: c.firstName || "(?)",
          lastName: c.lastName,
          avatarColor: colors[ci++ % colors.length]!,
          stance: "UNKNOWN",
          ...data,
        },
      });
      created++;
    }
  }
  return { created, updated, skipped };
}

export async function importOfficialSourceAction(
  source: "an" | "senat" | "pe",
): Promise<ImportResult> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (session.role !== "ADMIN")
    return { error: "Réservé aux administrateurs" };

  try {
    let contacts: ImportedContact[];
    if (source === "an") {
      contacts = await importAssembleeNationale();
    } else if (source === "senat") {
      contacts = await importSenat();
    } else {
      contacts = await importParlementEuropeen();
    }
    const stats = await upsertImported(session.workspaceId, contacts);
    revalidatePath("/contacts");
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

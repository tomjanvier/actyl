"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import {
  PRESIDENTIELLE_PACK_KEY,
  PRESIDENTIELLE_SETTING_KEY,
  PRESIDENTIELLE_LISTS,
} from "@/lib/datasets/presidentielle-2027";
import { mergePeopleIntoList } from "@/lib/lists-import";
import { workspaceSettingKey } from "@/lib/workspace-settings";

export type PackToggleResult = {
  ok?: boolean;
  error?: string;
  created?: number;
};

async function ensurePackLists(workspaceId: string, userId: string) {
  const results: Array<{ listId: string; published: boolean }> = [];
  for (const def of PRESIDENTIELLE_LISTS) {
    let list = await db.sharedList.findFirst({
      where: { workspaceId, name: def.name },
      select: { id: true, sourcePack: true },
    });
    if (!list) {
      const created = await db.sharedList.create({
        data: {
          workspaceId,
          name: def.name,
          description: def.description,
          sourcePack: PRESIDENTIELLE_PACK_KEY,
          createdById: userId,
        },
        select: { id: true, sourcePack: true },
      });
      list = created;
    } else if (list.sourcePack !== PRESIDENTIELLE_PACK_KEY) {
      // Rattache une liste existante au module Présidentielle.
      await db.sharedList.update({
        where: { id: list.id },
        data: { sourcePack: PRESIDENTIELLE_PACK_KEY },
      });
    }
    // L'import ajoute les absents sans écraser les contacts ou éléments existants.
    await mergePeopleIntoList(
      workspaceId,
      list.id,
      def.people.map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        title: p.title,
        institution: "Présidentielle 2027",
        party: p.party,
        level: "NATIONAL",
        note: p.note,
      })),
    );
    results.push({ listId: list.id, published: def.publishedByDefault });
  }
  return results;
}

/** Active ou désactive l'ensemble du module Présidentielle 2027. */
export async function setPresidentielleModuleAction(
  enabled: boolean,
): Promise<PackToggleResult> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "list:publish")) return { error: "Permission refusée" };

  const value = enabled ? "on" : "off";
  const settingKey = workspaceSettingKey(session.workspaceId, PRESIDENTIELLE_SETTING_KEY);
  await db.appSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value },
    update: { value },
  });

  if (enabled) {
    const lists = await ensurePackLists(session.workspaceId, session.user.id);
    // Publie les listes principales prévues par le pack.
    for (const l of lists) {
      if (l.published) {
        await db.sharedList.update({
          where: { id: l.listId },
          data: { isPublished: true },
        });
      }
    }
  } else {
    // Conserve les données tout en retirant leur accès public.
    await db.sharedList.updateMany({
      where: { workspaceId: session.workspaceId, sourcePack: PRESIDENTIELLE_PACK_KEY },
      data: { isPublished: false },
    });
  }

  revalidatePath("/presidentielle");
  revalidatePath("/lists");
  return { ok: true };
}

/**
 * Resynchronise le jeu éditorial dans les listes de l'espace.
 * L'opération ajoute les candidatures absentes sans modifier ni supprimer l'existant.
 */
export async function syncPresidentiellePackAction(): Promise<
  { ok?: boolean; error?: string; linked?: number; created?: number; already?: number }
> {
  const session = await getSession();
  if (!session) return { error: "Non authentifié" };
  if (!can(session.role, "list:create")) return { error: "Permission refusée" };

  const totals = { linked: 0, created: 0, already: 0 };
  const lists = await ensurePackLists(session.workspaceId, session.user.id);
  for (let i = 0; i < PRESIDENTIELLE_LISTS.length; i++) {
    const def = PRESIDENTIELLE_LISTS[i]!;
    const res = await mergePeopleIntoList(
      session.workspaceId,
      lists[i]!.listId,
      def.people.map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        title: p.title,
        institution: "Présidentielle 2027",
        party: p.party,
        level: "NATIONAL",
        note: p.note,
      })),
    );
    totals.linked += res.linked;
    totals.created += res.created;
    totals.already += res.already;
  }
  revalidatePath("/presidentielle");
  revalidatePath("/lists");
  return { ok: true, ...totals };
}

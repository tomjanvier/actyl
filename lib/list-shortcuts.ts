import "server-only";

import { db } from "@/lib/db";
import { workspaceSettingKey } from "@/lib/workspace-settings";

function shortcutKey(workspaceId: string, userId: string) {
  return workspaceSettingKey(workspaceId, `list_shortcuts_${userId}`);
}

/** Retourne les identifiants de listes épinglées par un utilisateur. */
export async function getListShortcutIds(workspaceId: string, userId: string) {
  const setting = await db.appSetting.findUnique({
    where: { key: shortcutKey(workspaceId, userId) },
    select: { value: true },
  });
  if (!setting) return [];
  try {
    const ids = JSON.parse(setting.value);
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string").slice(0, 12)
      : [];
  } catch {
    return [];
  }
}

/** Enregistre au plus douze raccourcis personnels dans l'espace actif. */
export async function saveListShortcutIds(
  workspaceId: string,
  userId: string,
  listIds: string[],
) {
  const key = shortcutKey(workspaceId, userId);
  await db.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(listIds.slice(0, 12)) },
    update: { value: JSON.stringify(listIds.slice(0, 12)) },
  });
}

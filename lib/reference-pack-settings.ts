import "server-only";

import { db } from "@/lib/db";
import {
  REFERENCE_PACKS,
  type ReferencePackKey,
} from "@/lib/datasets/reference-packs";
import { workspaceSettingKey } from "@/lib/workspace-settings";

const SETTING_PREFIX = "reference_pack_enabled_";
const LEGACY_PRESIDENTIELLE_SETTING = "pack_presidentielle_2027";

/** Construit la clé d'activation d'un référentiel pour un espace. */
export function referencePackSettingKey(
  workspaceId: string,
  pack: ReferencePackKey,
) {
  return workspaceSettingKey(workspaceId, `${SETTING_PREFIX}${pack}`);
}

/** Retourne les référentiels explicitement désactivés dans un espace. */
export async function getDisabledReferencePacks(workspaceId: string) {
  const legacyPresidentielleKey = workspaceSettingKey(
    workspaceId,
    LEGACY_PRESIDENTIELLE_SETTING,
  );
  const settings = await db.appSetting.findMany({
    where: {
      key: {
        in: [
          ...REFERENCE_PACKS.map((pack) =>
            referencePackSettingKey(workspaceId, pack.key),
          ),
          legacyPresidentielleKey,
        ],
      },
    },
    select: { key: true, value: true },
  });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));

  const disabled = new Set<ReferencePackKey>();
  for (const pack of REFERENCE_PACKS) {
    const currentValue = values.get(referencePackSettingKey(workspaceId, pack.key));
    const disabledByLegacySetting =
      pack.key === "presidentielle-2027" &&
      currentValue === undefined &&
      values.get(legacyPresidentielleKey) === "off";
    if (currentValue === "off" || disabledByLegacySetting) {
      disabled.add(pack.key);
    }
  }
  return disabled;
}
